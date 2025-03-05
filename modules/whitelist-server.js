const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');

// Configuração
const CONFIG = {
    port: process.env.WHITELIST_PORT || 3000,
    jwtSecret: process.env.JWT_SECRET || uuidv4(), // Gerar segredo único ao iniciar
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123', // Senha para painel admin
    sessionDuration: '24h', // Duração do token de sessão
    whitelistLinkDuration: 30, // Minutos que um link de convite é válido
    // Configuração OAuth do Discord
    discord: {
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        redirectUri: process.env.DISCORD_REDIRECT_URI || `http://56.124.64.115/auth/discord/callback`,
        scope: ['identify', 'email']
    },
    formFields: [
        { 
            id: 'nome', 
            label: 'Nome', 
            type: 'text', 
            required: true,
            placeholder: 'Seu nome no jogo',
            validation: {
                pattern: '^[a-zA-Z\\s]{3,30}$',
                message: 'Nome deve conter apenas letras e ter entre 3 e 30 caracteres'
            }
        },
        { 
            id: 'idade', 
            label: 'Idade', 
            type: 'number', 
            required: true,
            min: 13,
            max: 100,
            placeholder: 'Sua idade',
            validation: {
                min: 13,
                max: 100,
                message: 'Idade deve estar entre 13 e 100 anos'
            }
        },
        {
            id: 'encontrou_servidor',
            label: 'Aonde encontrou o Servidor',
            type: 'text',
            required: true,
            placeholder: 'Como você descobriu sobre o Metânia',
            validation: {
                minLength: 3,
                maxLength: 200,
                message: 'Por favor, forneça uma resposta entre 3 e 200 caracteres'
            }
        },
        { 
            id: 'motivo', 
            label: 'Por que quer entrar', 
            type: 'textarea', 
            required: true,
            placeholder: 'Explique por que você quer entrar no nosso servidor',
            validation: {
                minLength: 20,
                maxLength: 500,
                message: 'Motivo deve ter entre 20 e 500 caracteres'
            }
        },
        {
            id: 'religiao',
            label: 'Religião',
            type: 'text',
            required: true,
            placeholder: 'Sua religião',
            validation: {
                minLength: 2,
                maxLength: 100,
                message: 'Por favor, forneça uma resposta entre 2 e 100 caracteres'
            }
        },
        {
            id: 'contribuicao',
            label: 'O que você acha que pode contribuir para a comunidade',
            type: 'textarea',
            required: true,
            placeholder: 'Descreva como você pode contribuir para o servidor',
            validation: {
                minLength: 20,
                maxLength: 500,
                message: 'Sua resposta deve ter entre 20 e 500 caracteres'
            }
        }
    ]
};

// Classe principal do servidor de whitelist
class WhitelistServer {
    constructor(client, options = {}) {
        this.client = client;
        this.options = { ...CONFIG, ...options };
        this.app = express();
        this.server = null;
        this.db = {
            forms: {},
            pendingLinks: {},
            admins: {},
            authStates: {},
            botSettings: {
                chatFilter: {
                    enabled: true
                },
                autoModeration: {
                    enabled: true
                },
                whitelistSystem: {
                    enabled: true,
                    requireApproval: true
                }
            }
        };
        
        this.setupDb();
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    // Inicializa e carrega o banco de dados
    setupDb() {
        const dbPath = path.join(__dirname, '..', 'database');
        if (!fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath, { recursive: true });
        }
        
        // Carregar formulários existentes
        const formsPath = path.join(dbPath, 'whitelist-forms.json');
        if (fs.existsSync(formsPath)) {
            try {
                this.db.forms = JSON.parse(fs.readFileSync(formsPath, 'utf-8'));
            } catch (error) {
                console.error('Erro ao carregar formulários:', error);
                this.db.forms = {};
            }
        }
        
        // Configurar senha admin
        const adminsPath = path.join(dbPath, 'whitelist-admins.json');
        if (fs.existsSync(adminsPath)) {
            try {
                this.db.admins = JSON.parse(fs.readFileSync(adminsPath, 'utf-8'));
            } catch (error) {
                console.error('Erro ao carregar admins:', error);
                this.db.admins = {};
            }
        }
        
        // Garantir que pelo menos um admin existe
        if (Object.keys(this.db.admins).length === 0) {
            const defaultAdmin = {
                username: 'admin',
                passwordHash: bcrypt.hashSync(this.options.adminPassword, 10),
                role: 'admin',
                createdAt: new Date().toISOString()
            };
            
            this.db.admins[defaultAdmin.username] = defaultAdmin;
            this.saveAdmins();
        }
        
        // Carregar configurações do bot
        const botSettingsPath = path.join(dbPath, 'bot-settings.json');
        if (fs.existsSync(botSettingsPath)) {
            try {
                this.db.botSettings = JSON.parse(fs.readFileSync(botSettingsPath, 'utf-8'));
            } catch (error) {
                console.error('Erro ao carregar configurações do bot:', error);
            }
        } else {
            // Salvar configurações padrão
            this.saveBotSettings();
        }
    }
    
    // Configura middleware do express
    setupMiddleware() {
        this.app.use(bodyParser.json());
        this.app.use(cors());
        
        // Middleware para obter IP real
        this.app.use((req, res, next) => {
            req.realIp = req.headers['x-forwarded-for'] || 
                         req.connection.remoteAddress || 
                         req.socket.remoteAddress || 
                         req.connection.socket.remoteAddress;
            
            // Remover "::ffff:" do IPv4 mapeado para IPv6
            if (req.realIp && req.realIp.substr(0, 7) == "::ffff:") {
                req.realIp = req.realIp.substr(7);
            }
            
            next();
        });
        
        // Middleware de autenticação para rotas protegidas
        this.authMiddleware = (req, res, next) => {
            try {
                const token = req.headers.authorization?.split(' ')[1];
                if (!token) {
                    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
                }
                
                const decoded = jwt.verify(token, this.options.jwtSecret);
                req.user = decoded;
                next();
            } catch (error) {
                return res.status(401).json({ error: 'Token inválido ou expirado' });
            }
        };
    }
    
    // Configura rotas da API
    setupRoutes() {
        // Servir o frontend
        this.app.use(express.static(path.join(__dirname, '..', 'whitelist-frontend')));
        
        // Rotas de autenticação do Discord
        this.setupDiscordAuth();
        
        // API de informações gerais
        this.app.get('/api/config', (req, res) => {
            res.json({
                formFields: this.options.formFields,
                serverName: this.client.guilds.cache.first()?.name || 'Servidor Discord'
            });
        });
        
        // Validar link de whitelist
        this.app.get('/api/validate-link/:token', (req, res) => {
            const { token } = req.params;
            
            if (!this.db.pendingLinks[token]) {
                return res.status(404).json({ valid: false, error: 'Link inválido ou expirado' });
            }
            
            const link = this.db.pendingLinks[token];
            const now = new Date();
            const expiry = new Date(link.expiresAt);
            
            if (now > expiry) {
                delete this.db.pendingLinks[token];
                return res.status(400).json({ valid: false, error: 'Link expirado' });
            }
            
            res.json({ valid: true, userId: link.userId, username: link.username });
        });
        
        // Verificar status de autenticação
        this.app.get('/api/auth/status', (req, res) => {
            const token = req.headers.authorization?.split(' ')[1];
            
            if (!token) {
                return res.json({ authenticated: false });
            }
            
            try {
                const decoded = jwt.verify(token, this.options.jwtSecret);
                res.json({ 
                    authenticated: true, 
                    user: {
                        id: decoded.id,
                        username: decoded.username,
                        avatar: decoded.avatar
                    }
                });
            } catch (error) {
                res.json({ authenticated: false });
            }
        });
        
        // Processar envio de formulário
        this.app.post('/api/submit', async (req, res) => {
            const formData = req.body;
            const clientIp = req.realIp;
            const token = req.headers.authorization?.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({ error: 'Não autenticado' });
            }
            
            try {
                const decoded = jwt.verify(token, this.options.jwtSecret);
                
                // Validar campos do formulário
                for (const field of this.options.formFields) {
                    if (field.required && !formData[field.id]) {
                        return res.status(400).json({ error: `Campo ${field.label} é obrigatório` });
                    }
                }
                
                // Verificar se o usuário já tem um formulário pendente ou aprovado
                const existingForm = Object.values(this.db.forms).find(form => 
                    form.userId === decoded.id && 
                    (form.status === 'pendente' || form.status === 'aprovado')
                );
                
                if (existingForm) {
                    if (existingForm.status === 'pendente') {
                        return res.status(400).json({ error: 'Você já tem uma solicitação de whitelist pendente' });
                    } else {
                        return res.status(400).json({ error: 'Você já tem uma whitelist aprovada' });
                    }
                }
                
                // Gerar ID único para o formulário
                const formId = uuidv4();
                
                // Adicionar dados do usuário e timestamps
                const newForm = {
                    id: formId,
                    userId: decoded.id,
                    username: decoded.username,
                    discordTag: decoded.discordTag,
                    guildId: decoded.guildId || this.client.guilds.cache.first()?.id,
                    status: 'pendente',
                    data: formData,
                    clientIp: clientIp, // Registrar IP do cliente
                    userAgent: req.headers['user-agent'] || 'Unknown',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // Salvar formulário
                this.db.forms[formId] = newForm;
                this.saveForms();
                
                // Enviar notificação para o canal de logs
                this.notifyNewForm(newForm);
                
                res.json({ success: true, formId });
            } catch (error) {
                console.error('Erro na autenticação:', error);
                return res.status(401).json({ error: 'Token inválido ou expirado' });
            }
        });
        
        // Login admin
        this.app.post('/api/admin/login', (req, res) => {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
            }
            
            const admin = this.db.admins[username];
            if (!admin) {
                return res.status(401).json({ error: 'Usuário ou senha inválidos' });
            }
            
            const passwordMatch = bcrypt.compareSync(password, admin.passwordHash);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Usuário ou senha inválidos' });
            }
            
            // Gerar token JWT
            const token = jwt.sign(
                { username, role: admin.role },
                this.options.jwtSecret,
                { expiresIn: this.options.sessionDuration }
            );
            
            // Registrar IP do login
            const loginIp = req.realIp;
            this.logAdminActivity(username, 'login', { ip: loginIp });
            
            res.json({ token, user: { username, role: admin.role } });
        });
        
        // Obter lista de formulários (protegido)
        this.app.get('/api/admin/forms', this.authMiddleware, (req, res) => {
            // Converter objeto em array e ordenar por data (mais recentes primeiro)
            const forms = Object.values(this.db.forms)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            res.json(forms);
        });
        
        // Obter detalhes de um formulário (protegido)
        this.app.get('/api/admin/forms/:id', this.authMiddleware, (req, res) => {
            const { id } = req.params;
            const form = this.db.forms[id];
            
            if (!form) {
                return res.status(404).json({ error: 'Formulário não encontrado' });
            }
            
            res.json(form);
        });
        
        // Aprovar/rejeitar formulário (protegido)
        this.app.post('/api/admin/forms/:id/review', this.authMiddleware, async (req, res) => {
            const { id } = req.params;
            const { status, feedback } = req.body;
            
            if (!['aprovado', 'rejeitado'].includes(status)) {
                return res.status(400).json({ error: 'Status inválido' });
            }
            
            const form = this.db.forms[id];
            if (!form) {
                return res.status(404).json({ error: 'Formulário não encontrado' });
            }
            
            // Atualizar status
            form.status = status;
            form.feedback = feedback || '';
            form.reviewedBy = req.user.username;
            form.reviewedAt = new Date().toISOString();
            form.updatedAt = new Date().toISOString();
            
            // Salvar formulário atualizado
            this.db.forms[id] = form;
            this.saveForms();
            
            // Registrar ação do admin
            this.logAdminActivity(req.user.username, `formulario_${status}`, { 
                formId: id, 
                userId: form.userId,
                ip: req.realIp
            });
            
            // Notificar o usuário
            await this.notifyUser(form, status, feedback);
            
            res.json({ success: true, form });
        });
        
        // ==== NOVAS ROTAS DO PAINEL ADMIN ====
        
        // Obter configurações do bot
        this.app.get('/api/admin/bot-settings', this.authMiddleware, (req, res) => {
            res.json(this.db.botSettings);
        });
        
        // Atualizar configurações do bot
        this.app.post('/api/admin/bot-settings', this.authMiddleware, (req, res) => {
            const { settings } = req.body;
            
            if (!settings) {
                return res.status(400).json({ error: 'Configurações inválidas' });
            }
            
            // Atualizar configurações
            this.db.botSettings = {
                ...this.db.botSettings,
                ...settings
            };
            
            // Salvar configurações
            this.saveBotSettings();
            
            // Registrar ação do admin
            this.logAdminActivity(req.user.username, 'atualizar_config_bot', { 
                ip: req.realIp
            });
            
            res.json({ success: true, settings: this.db.botSettings });
        });
        
        // Obter registros de atividade admin
        this.app.get('/api/admin/activity-logs', this.authMiddleware, (req, res) => {
            const logsPath = path.join(__dirname, '..', 'database', 'admin-activity.json');
            let logs = [];
            
            if (fs.existsSync(logsPath)) {
                try {
                    logs = JSON.parse(fs.readFileSync(logsPath, 'utf-8'));
                } catch (error) {
                    console.error('Erro ao ler logs de atividade:', error);
                }
            }
            
            res.json(logs);
        });
        
        // Obter estatísticas e resumo
        this.app.get('/api/admin/dashboard', this.authMiddleware, (req, res) => {
            // Contagem de formulários por status
            const forms = Object.values(this.db.forms);
            const countByStatus = {
                total: forms.length,
                pendente: forms.filter(f => f.status === 'pendente').length,
                aprovado: forms.filter(f => f.status === 'aprovado').length,
                rejeitado: forms.filter(f => f.status === 'rejeitado').length
            };
            
            // Atividade recente
            const recentActivity = this.getRecentAdminActivity(5);
            
            // Whitelists por data (último mês)
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            
            const whitelistByDate = {};
            forms.forEach(form => {
                const date = new Date(form.createdAt).toISOString().split('T')[0];
                if (!whitelistByDate[date]) {
                    whitelistByDate[date] = 0;
                }
                whitelistByDate[date]++;
            });
            
            res.json({
                countByStatus,
                recentActivity,
                whitelistByDate,
                botSettings: this.db.botSettings
            });
        });
        
        // Rota de fallback - encaminha todas as outras rotas para o frontend
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'whitelist-frontend', 'index.html'));
        });
    }
    
    // Configuração das rotas de autenticação do Discord
    setupDiscordAuth() {
        // Rota para iniciar autenticação com Discord
        this.app.get('/auth/discord', (req, res) => {
            const state = uuidv4();
            const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
            
            discordAuthUrl.searchParams.append('client_id', this.options.discord.clientId);
            discordAuthUrl.searchParams.append('redirect_uri', this.options.discord.redirectUri);
            discordAuthUrl.searchParams.append('response_type', 'code');
            discordAuthUrl.searchParams.append('scope', this.options.discord.scope.join(' '));
            discordAuthUrl.searchParams.append('state', state);
            
            // Armazenar o estado para verificar depois
            this.db.authStates = this.db.authStates || {};
            this.db.authStates[state] = {
                createdAt: new Date().toISOString(),
                returnUrl: req.query.returnUrl || '/'
            };
            
            res.redirect(discordAuthUrl.toString());
        });
        
        // Callback da autenticação com Discord
        this.app.get('/auth/discord/callback', async (req, res) => {
            const { code, state } = req.query;
            
            // Verificar o estado para prevenir CSRF
            if (!state || !this.db.authStates[state]) {
                return res.redirect('/?error=invalid_state');
            }
            
            const returnUrl = this.db.authStates[state].returnUrl;
            delete this.db.authStates[state];
            
            if (!code) {
                return res.redirect('/?error=no_code');
            }
            
            try {
                // Trocar o código por um token de acesso
                const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        client_id: this.options.discord.clientId,
                        client_secret: this.options.discord.clientSecret,
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: this.options.discord.redirectUri
                    })
                });
                
                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text();
                    console.error('Erro na resposta do token Discord:', errorText);
                    return res.redirect('/?error=token_exchange');
                }
                
                const tokenData = await tokenResponse.json();
                
                // Obter informações do usuário
                const userResponse = await fetch('https://discord.com/api/users/@me', {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`
                    }
                });
                
                if (!userResponse.ok) {
                    return res.redirect('/?error=user_info');
                }
                
                const userData = await userResponse.json();
                
                // Gerar JWT para o usuário
                const token = jwt.sign(
                    { 
                        id: userData.id,
                        username: userData.username,
                        discordTag: `${userData.username}#${userData.discriminator}`,
                        avatar: userData.avatar,
                        email: userData.email,
                        guildId: this.client.guilds.cache.first()?.id
                    },
                    this.options.jwtSecret,
                    { expiresIn: this.options.sessionDuration }
                );
                
                // Redirecionar para a página de origem com o token
                return res.redirect(`${returnUrl}?token=${token}`);
                
            } catch (error) {
                console.error('Erro na autenticação Discord:', error);
                return res.redirect('/?error=auth_error');
            }
        });
    }
    
    // Registra atividade do admin
    logAdminActivity(username, action, details = {}) {
        const activityLog = {
            username,
            action,
            timestamp: new Date().toISOString(),
            details
        };
        
        const logsPath = path.join(__dirname, '..', 'database', 'admin-activity.json');
        let logs = [];
        
        if (fs.existsSync(logsPath)) {
            try {
                logs = JSON.parse(fs.readFileSync(logsPath, 'utf-8'));
            } catch (error) {
                console.error('Erro ao ler logs de atividade:', error);
            }
        }
        
        logs.push(activityLog);
        
        // Limitar a 1000 entradas para controlar tamanho
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }
        
        try {
            fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2), 'utf-8');
        } catch (error) {
            console.error('Erro ao salvar logs de atividade:', error);
        }
        
        return activityLog;
    }
    
    // Obter atividade recente de admins
    getRecentAdminActivity(limit = 10) {
        const logsPath = path.join(__dirname, '..', 'database', 'admin-activity.json');
        let logs = [];
        
        if (fs.existsSync(logsPath)) {
            try {
                logs = JSON.parse(fs.readFileSync(logsPath, 'utf-8'));
            } catch (error) {
                console.error('Erro ao ler logs de atividade:', error);
            }
        }
        
        // Ordenar por data e limitar ao número especificado
        return logs
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }
    
    // Salva configurações do bot
    saveBotSettings() {
        const dbPath = path.join(__dirname, '..', 'database');
        const settingsPath = path.join(dbPath, 'bot-settings.json');
        
        try {
            fs.writeFileSync(settingsPath, JSON.stringify(this.db.botSettings, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('Erro ao salvar configurações do bot:', error);
            return false;
        }
    }
    
    // Salva os formulários no arquivo
    saveForms() {
        const dbPath = path.join(__dirname, '..', 'database');
        const formsPath = path.join(dbPath, 'whitelist-forms.json');
        
        try {
            fs.writeFileSync(formsPath, JSON.stringify(this.db.forms, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('Erro ao salvar formulários:', error);
            return false;
        }
    }
    
    // Salva os administradores no arquivo
    saveAdmins() {
        const dbPath = path.join(__dirname, '..', 'database');
        const adminsPath = path.join(dbPath, 'whitelist-admins.json');
        
        try {
            fs.writeFileSync(adminsPath, JSON.stringify(this.db.admins, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('Erro ao salvar administradores:', error);
            return false;
        }
    }
    
    // Notifica no canal de logs sobre um novo formulário
    async notifyNewForm(form) {
        try {
            // Encontrar guild e canal de logs
            const guild = this.client.guilds.cache.get(form.guildId);
            if (!guild) return;
            
            const logChannel = guild.channels.cache.find(ch => ch.name === 'logs-wl');
            if (!logChannel) return;
            
            // Preparar embed
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📝 Nova Solicitação de Whitelist')
                .setDescription(`Usuário **${form.username}** enviou um formulário de whitelist pelo site.`)
                .addFields(
                    { name: 'Usuário', value: `<@${form.userId}>`, inline: true },
                    { name: 'ID do Formulário', value: form.id.substring(0, 8), inline: true },
                    { name: 'IP do Cliente', value: form.clientIp || 'Desconhecido', inline: true },
                    { name: 'Enviado em', value: new Date(form.createdAt).toLocaleString('pt-BR'), inline: true }
                )
                .setFooter({ text: 'Utilize o painel admin para revisar esta solicitação' })
                .setTimestamp();
                
            // Adicionar campos do formulário
            for (const [key, value] of Object.entries(form.data)) {
                const fieldConfig = this.options.formFields.find(f => f.id === key);
                if (fieldConfig) {
                    embed.addFields({ name: fieldConfig.label, value: value.toString() });
                }
            }
            
            // Adicionar botões para ação rápida
            const approveButton = {
                type: 2, // BUTTON
                style: 3, // SUCCESS
                label: 'Aprovar',
                custom_id: `wl_approve_${form.id}`
            };
            
            const rejectButton = {
                type: 2, // BUTTON
                style: 4, // DANGER
                label: 'Rejeitar',
                custom_id: `wl_reject_${form.id}`
            };
            
            const adminButton = {
                type: 2, // BUTTON
                style: 5, // LINK
                label: 'Abrir no Painel',
                url: `http://56.124.64.115:${this.options.port}/admin/forms/${form.id}`
            };
            
            const actionRow = {
                type: 1, // ACTION_ROW
                components: [approveButton, rejectButton, adminButton]
            };
            
            // Enviar para o canal
            await logChannel.send({ embeds: [embed], components: [actionRow] });
            
            // Também registrar no novo sistema de logs
            if (logger && logger.logWhitelist) {
                logger.logWhitelist(guild, {
                    userId: form.userId,
                    username: form.username,
                    status: 'pendente',
                    clientIp: form.clientIp,
                    ...form.data
                });
            }
        } catch (error) {
            console.error('Erro ao notificar sobre novo formulário:', error);
        }
    }
    
    // Notifica o usuário sobre a decisão
    async notifyUser(form, status, feedback) {
        try {
            // Encontrar o usuário
            const user = await this.client.users.fetch(form.userId).catch(() => null);
            if (!user) return;
            
            const guild = this.client.guilds.cache.get(form.guildId);
            if (!guild) return;
            
            const embed = new EmbedBuilder()
                .setColor(status === 'aprovado' ? '#2ecc71' : '#e74c3c')
                .setTitle(status === 'aprovado' ? '✅ Whitelist Aprovada!' : '❌ Whitelist Rejeitada')
                .setDescription(
                    status === 'aprovado' 
                        ? `Parabéns! Sua solicitação de whitelist para o servidor **${guild.name}** foi **APROVADA**!`
                        : `Sua solicitação de whitelist para o servidor **${guild.name}** foi **REJEITADA**.`
                )
                .setTimestamp();
                
            if (feedback) {
                embed.addFields({ name: 'Feedback', value: feedback });
            }
            
            // Adicionar próximos passos se aprovado
            if (status === 'aprovado') {
                embed.addFields({ name: 'Próximos Passos', value: 'Você já pode entrar no servidor! Seu acesso foi liberado automaticamente.' });
            }
            
            // Enviar mensagem privada
            await user.send({ embeds: [embed] }).catch(() => {});
            
            // Se aprovado, adicionar cargo de whitelist
            if (status === 'aprovado') {
                try {
                    const member = await guild.members.fetch(form.userId);
                    const role = guild.roles.cache.find(r => r.name === 'Acess');
                    
                    if (member && role) {
                        await member.roles.add(role);
                    }
                } catch (error) {
                    console.error('Erro ao adicionar cargo de whitelist:', error);
                }
            }
            
            // Log no canal apropriado
            const logChannel = guild.channels.cache.find(ch => ch.name === 'logs-wl');
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(status === 'aprovado' ? '#2ecc71' : '#e74c3c')
                    .setTitle(status === 'aprovado' ? '✅ Whitelist Aprovada' : '❌ Whitelist Rejeitada')
                    .setDescription(`A whitelist de <@${form.userId}> foi ${status}.`)
                    .addFields(
                        { name: 'Revisado por', value: form.reviewedBy, inline: true },
                        { name: 'ID do Formulário', value: form.id.substring(0, 8), inline: true },
                        { name: 'IP do Cliente', value: form.clientIp || 'Desconhecido', inline: true }
                    )
                    .setTimestamp();
                    
                if (feedback) {
                    logEmbed.addFields({ name: 'Feedback', value: feedback });
                }
                
                await logChannel.send({ embeds: [logEmbed] });
                
                // Usar o novo sistema de logs também
                if (logger && logger.logWhitelist) {
                    logger.logWhitelist(guild, {
                        userId: form.userId,
                        username: form.username,
                        status,
                        approver: form.reviewedBy,
                        clientIp: form.clientIp,
                        ...form.data
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao notificar usuário:', error);
        }
    }
    
    // Cria um link único para um usuário acessar o formulário
    createWhitelistLink(userId, guildId) {
        // Obter informações do usuário
        const user = this.client.users.cache.get(userId);
        if (!user) return null;
        
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return null;
        
        // Verificar se o usuário já tem um link pendente
        const existingToken = Object.entries(this.db.pendingLinks).find(([_, link]) => link.userId === userId);
        if (existingToken) {
            // Se o link ainda for válido, retorna ele
            const [token, link] = existingToken;
            const now = new Date();
            const expiry = new Date(link.expiresAt);
            
            if (now < expiry) {
                return `http://56.124.64.115:${this.options.port}/whitelist/${token}`;
            }
            
            // Se expirado, remove
            delete this.db.pendingLinks[token];
        }
        
        // Verificar se o usuário já tem um formulário enviado
        const existingForm = Object.values(this.db.forms).find(form => 
            form.userId === userId && form.status === 'pendente'
        );
        
        if (existingForm) {
            return null; // Usuário já tem um formulário pendente
        }
        
        // Gerar token único
        const token = uuidv4();
        
        // Calcular data de expiração
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.options.whitelistLinkDuration);
        
        // Armazenar link
        this.db.pendingLinks[token] = {
            userId,
            username: user.username,
            discordTag: user.tag,
            guildId,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString()
        };
        
        return `http://56.124.64.115:${this.options.port}/whitelist/${token}`;
    }
    
    // Inicia o servidor HTTP
    start() {
        // Verificar diretório do frontend
        const frontendPath = path.join(__dirname, '..', 'whitelist-frontend');
        if (!fs.existsSync(frontendPath)) {
            fs.mkdirSync(frontendPath, { recursive: true });
            console.log('⚠️ Criando diretório do frontend...');
            
            // Criar um arquivo index.html básico
            const indexPath = path.join(frontendPath, 'index.html');
            const basicHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema de Whitelist - Metânia</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        metania: {
                            500: '#0f1122',
                            600: '#0a0c17',
                            700: '#06080e'
                        },
                        discord: {
                            500: '#5865F2',
                            600: '#4752C4',
                            700: '#3C45A5'
                        },
                        dark: {
                            800: '#1e2039',
                            900: '#0f1122'
                        }
                    }
                }
            }
        }
    </script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Poppins', sans-serif;
            background-color: #0f1122;
            color: #e2e8f0;
        }
    </style>
</head>
<body class="bg-dark-900 min-h-screen text-gray-100">
    <div class="min-h-screen flex items-center justify-center">
        <div class="bg-dark-800 p-8 rounded-lg shadow-md max-w-md w-full">
            <div class="text-center mb-6">
                <h1 class="text-2xl font-bold text-white">Sistema de Whitelist Metânia</h1>
                <p class="text-gray-400">
                    Por favor, acesse através do Discord usando o comando /whitelist.
                </p>
            </div>
            <div class="mt-4 text-center text-sm text-gray-500">
                <p>Desenvolvido para Metânia por Mr.Dark</p>
            </div>
        </div>
    </div>
</body>
</html>`;
            fs.writeFileSync(indexPath, basicHtml);
            
            console.log('⚠️ Diretório do frontend criado com um arquivo HTML básico.');
        }
        
        // Iniciar servidor HTTP
        this.server = http.createServer(this.app);
        
        return new Promise((resolve, reject) => {
            this.server.listen(this.options.port, () => {
                console.log(`✅ Servidor de whitelist rodando na porta ${this.options.port}`);
                resolve();
            });
            
            this.server.on('error', (error) => {
                console.error('❌ Erro ao iniciar servidor de whitelist:', error);
                reject(error);
            });
        });
    }
    
    // Para o servidor HTTP
    stop() {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }
            
            this.server.close((error) => {
                if (error) {
                    console.error('❌ Erro ao parar servidor de whitelist:', error);
                    reject(error);
                } else {
                    console.log('✅ Servidor de whitelist parado com sucesso');
                    this.server = null;
                    resolve();
                }
            });
        });
    }
}

module.exports = WhitelistServer;
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
    port: process.env.WHITELIST_PORT || 5000,
    jwtSecret: process.env.JWT_SECRET || uuidv4(), // Gerar segredo único ao iniciar
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123', // Senha para painel admin
    sessionDuration: '24h', // Duração do token de sessão
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
            users: {},
            admins: {},
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
        
        // Carregar usuários
        const usersPath = path.join(dbPath, 'whitelist-users.json');
        if (fs.existsSync(usersPath)) {
            try {
                this.db.users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
            } catch (error) {
                console.error('Erro ao carregar usuários:', error);
                this.db.users = {};
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
        
        // API de informações gerais
        this.app.get('/api/config', (req, res) => {
            res.json({
                formFields: this.options.formFields,
                serverName: this.client.guilds.cache.first()?.name || 'Servidor Discord'
            });
        });

        // Rotas para autenticação direta (sem Discord)
        this.setupDirectAuth();
        
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
                        discordId: decoded.discordId
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
                    discordId: decoded.discordId || null,
                    guildId: this.client.guilds.cache.first()?.id,
                    status: 'pendente',
                    data: formData,
                    clientIp: clientIp,
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
            
            // Notificar o usuário se tiver ID do Discord
            if (form.discordId) {
                await this.notifyUser(form, status, feedback);
            }
            
            res.json({ success: true, form });
        });
        
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
    
    // Configuração das rotas de autenticação direta (sem Discord)
    setupDirectAuth() {
        // Registro de usuário
        this.app.post('/api/auth/register', async (req, res) => {
            const { username, password, discordId } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios' });
            }
            
            // Validação básica
            if (username.length < 3 || username.length > 20) {
                return res.status(400).json({ error: 'Nome de usuário deve ter entre 3 e 20 caracteres' });
            }
            
            if (password.length < 6) {
                return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
            }
            
            // Verificar se nome de usuário já existe
            if (Object.values(this.db.users).some(user => user.username.toLowerCase() === username.toLowerCase())) {
                return res.status(400).json({ error: 'Nome de usuário já em uso' });
            }
            
            // Criar novo usuário
            const userId = uuidv4();
            const newUser = {
                id: userId,
                username,
                discordId: discordId || null,
                passwordHash: bcrypt.hashSync(password, 10),
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                ip: req.realIp
            };
            
            // Salvar usuário
            this.db.users[userId] = newUser;
            this.saveUsers();
            
            // Gerar token JWT
            const token = jwt.sign(
                { 
                    id: userId, 
                    username,
                    discordId: discordId || null
                },
                this.options.jwtSecret,
                { expiresIn: this.options.sessionDuration }
            );
            
            // Retornar token e dados básicos do usuário
            res.json({ 
                token, 
                user: { 
                    id: userId, 
                    username, 
                    discordId: discordId || null 
                } 
            });
        });
        
        // Login
        this.app.post('/api/auth/login', async (req, res) => {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios' });
            }
            
            // Buscar usuário pelo nome de usuário
            const user = Object.values(this.db.users).find(
                u => u.username.toLowerCase() === username.toLowerCase()
            );
            
            if (!user) {
                return res.status(401).json({ error: 'Nome de usuário ou senha inválidos' });
            }
            
            // Verificar senha
            const passwordMatch = bcrypt.compareSync(password, user.passwordHash);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Nome de usuário ou senha inválidos' });
            }
            
            // Atualizar último login
            user.lastLogin = new Date().toISOString();
            user.ip = req.realIp;
            this.saveUsers();
            
            // Gerar token JWT
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username,
                    discordId: user.discordId
                },
                this.options.jwtSecret,
                { expiresIn: this.options.sessionDuration }
            );
            
            // Retornar token e dados básicos do usuário
            res.json({ 
                token, 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    discordId: user.discordId 
                } 
            });
        });
        
        // Associar ID do Discord (opcional, pode ser útil se os usuários quiserem vincular suas contas)
        this.app.post('/api/auth/link-discord', this.authMiddleware, async (req, res) => {
            const { discordId } = req.body;
            const userId = req.user.id;
            
            if (!discordId) {
                return res.status(400).json({ error: 'ID do Discord é obrigatório' });
            }
            
            // Verificar se o usuário existe
            const user = this.db.users[userId];
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            
            // Atualizar ID do Discord
            user.discordId = discordId;
            this.saveUsers();
            
            // Retornar dados atualizados
            res.json({ 
                success: true, 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    discordId: user.discordId 
                } 
            });
        });
    }
    
    // Salvar usuários
    saveUsers() {
        const dbPath = path.join(__dirname, '..', 'database');
        const usersPath = path.join(dbPath, 'whitelist-users.json');
        
        try {
            fs.writeFileSync(usersPath, JSON.stringify(this.db.users, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('Erro ao salvar usuários:', error);
            return false;
        }
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
                    { name: 'Usuário', value: form.discordId ? `<@${form.discordId}>` : form.username, inline: true },
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
                url: `http://56.124.64.115/admin/forms/${form.id}`
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
                    userId: form.discordId || form.userId,
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
            // Se não tiver ID do Discord, não podemos notificar
            if (!form.discordId) return;
            
            // Encontrar o usuário
            const user = await this.client.users.fetch(form.discordId).catch(() => null);
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
                    const member = await guild.members.fetch(form.discordId);
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
                    .setDescription(`A whitelist de <@${form.discordId}> foi ${status}.`)
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
                        userId: form.discordId,
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
                <p class="text-gray-400 mt-2">
                    Preencha o formulário para solicitar acesso ao servidor.
                </p>
            </div>
            
            <div class="space-y-4">
                <div>
                    <a href="/cadastro.html" class="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded text-center transition">
                        Criar Conta
                    </a>
                </div>
                
                <div>
                    <a href="/login.html" class="block w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded text-center transition">
                        Entrar
                    </a>
                </div>
            </div>
            
            <div class="mt-6 text-center text-sm text-gray-500">
                <p>Desenvolvido para Metânia por Mr.Dark</p>
            </div>
        </div>
    </div>
</body>
</html>`;
            fs.writeFileSync(indexPath, basicHtml);
            
            // Criar arquivo de login
            const loginPath = path.join(frontendPath, 'login.html');
            const loginHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Sistema de Whitelist</title>
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
                <h1 class="text-2xl font-bold text-white">Entrar</h1>
                <p class="text-gray-400 mt-2">
                    Faça login para acessar o sistema de whitelist
                </p>
            </div>
            
            <form id="loginForm" class="space-y-4">
                <div>
                    <label for="username" class="block text-sm font-medium text-gray-300">Nome de usuário</label>
                    <input type="text" id="username" name="username" required class="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                </div>
                
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-300">Senha</label>
                    <input type="password" id="password" name="password" required class="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                </div>
                
                <div>
                    <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Entrar
                    </button>
                </div>
                
                <div id="errorMessage" class="text-red-500 text-sm hidden"></div>
            </form>
            
            <div class="mt-4 text-center text-sm">
                <p class="text-gray-400">
                    Não tem uma conta? <a href="/cadastro.html" class="text-indigo-400 hover:text-indigo-300">Cadastre-se</a>
                </p>
            </div>
            
            <div class="mt-6 text-center text-sm text-gray-500">
                <p>Desenvolvido para Metânia por Mr.Dark</p>
            </div>
        </div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('errorMessage');
            
            try {
                errorMessage.classList.add('hidden');
                
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Erro ao fazer login');
                }
                
                // Salvar token no localStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirecionar para o formulário de whitelist
                window.location.href = '/formulario.html';
            } catch (error) {
                errorMessage.textContent = error.message;
                errorMessage.classList.remove('hidden');
            }
        });
    </script>
</body>
</html>`;
            fs.writeFileSync(loginPath, loginHtml);
            
            // Criar arquivo de cadastro
            const registerPath = path.join(frontendPath, 'cadastro.html');
            const registerHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cadastro - Sistema de Whitelist</title>
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
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="bg-dark-800 p-8 rounded-lg shadow-md max-w-md w-full">
            <div class="text-center mb-6">
                <h1 class="text-2xl font-bold text-white">Criar Conta</h1>
                <p class="text-gray-400 mt-2">
                    Crie sua conta para acessar o sistema de whitelist
                </p>
            </div>
            
            <form id="registerForm" class="space-y-4">
                <div>
                    <label for="username" class="block text-sm font-medium text-gray-300">Nome de usuário</label>
                    <input type="text" id="username" name="username" required class="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    <p class="text-xs text-gray-400 mt-1">Entre 3 e 20 caracteres</p>
                </div>
                
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-300">Senha</label>
                    <input type="password" id="password" name="password" required class="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    <p class="text-xs text-gray-400 mt-1">Mínimo de 6 caracteres</p>
                </div>
                
                <div>
                    <label for="discordId" class="block text-sm font-medium text-gray-300">ID do Discord (opcional)</label>
                    <input type="text" id="discordId" name="discordId" class="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    <p class="text-xs text-gray-400 mt-1">Se você já tem uma conta no Discord, informe seu ID</p>
                </div>
                
                <div>
                    <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Cadastrar
                    </button>
                </div>
                
                <div id="errorMessage" class="text-red-500 text-sm hidden"></div>
            </form>
            
            <div class="mt-4 text-center text-sm">
                <p class="text-gray-400">
                    Já tem uma conta? <a href="/login.html" class="text-indigo-400 hover:text-indigo-300">Faça login</a>
                </p>
            </div>
            
            <div class="mt-6 text-center text-sm text-gray-500">
                <p>Desenvolvido para Metânia por Mr.Dark</p>
            </div>
        </div>
    </div>

    <script>
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const discordId = document.getElementById('discordId').value;
            const errorMessage = document.getElementById('errorMessage');
            
            try {
                errorMessage.classList.add('hidden');
                
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password, discordId })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Erro ao criar conta');
                }
                
                // Salvar token no localStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirecionar para o formulário de whitelist
                window.location.href = '/formulario.html';
            } catch (error) {
                errorMessage.textContent = error.message;
                errorMessage.classList.remove('hidden');
            }
        });
    </script>
</body>
</html>`;
            fs.writeFileSync(registerPath, registerHtml);
            
            // Criar arquivo do formulário
            const formPath = path.join(frontendPath, 'formulario.html');
            const formHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formulário de Whitelist - Metânia</title>
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
    <div class="min-h-screen flex justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="bg-dark-800 p-8 rounded-lg shadow-md max-w-4xl w-full">
            <div class="text-center mb-6">
                <h1 class="text-2xl font-bold text-white">Formulário de Whitelist</h1>
                <p class="text-gray-400 mt-2">
                    Preencha o formulário abaixo para solicitar acesso ao servidor Metânia
                </p>
            </div>
            
            <div id="notLoggedIn" class="hidden text-center py-8">
                <p class="text-lg text-gray-300 mb-4">Você precisa estar logado para acessar o formulário</p>
                <div class="flex justify-center space-x-4">
                    <a href="/login.html" class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded">Fazer Login</a>
                    <a href="/cadastro.html" class="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded">Criar Conta</a>
                </div>
            </div>
            
            <form id="whitelistForm" class="space-y-6">
                <div id="formFields">
                    <!-- Os campos serão inseridos aqui via JavaScript -->
                </div>
                
                <div>
                    <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Enviar Solicitação
                    </button>
                </div>
                
                <div id="submitMessage" class="hidden p-4 rounded-md">
                    <!-- Mensagem após envio -->
                </div>
            </form>
            
            <div class="mt-6 text-center text-sm text-gray-500">
                <p>Desenvolvido para Metânia por Mr.Dark</p>
            </div>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', async () => {
            const token = localStorage.getItem('token');
            const formFieldsContainer = document.getElementById('formFields');
            const notLoggedInDiv = document.getElementById('notLoggedIn');
            const whitelistForm = document.getElementById('whitelistForm');
            const submitMessage = document.getElementById('submitMessage');
            
            // Verificar se está logado
            if (!token) {
                whitelistForm.classList.add('hidden');
                notLoggedInDiv.classList.remove('hidden');
                return;
            }
            
            // Carregar configuração do formulário
            try {
                const configResponse = await fetch('/api/config', {
                    headers: {
                        'Authorization': \`Bearer \${token}\`
                    }
                });
                
                if (!configResponse.ok) {
                    throw new Error('Erro ao carregar configuração');
                }
                
                const config = await configResponse.json();
                
                // Criar campos do formulário
                config.formFields.forEach(field => {
                    const fieldDiv = document.createElement('div');
                    
                    const label = document.createElement('label');
                    label.setAttribute('for', field.id);
                    label.className = 'block text-sm font-medium text-gray-300';
                    label.textContent = \`\${field.label}\${field.required ? ' *' : ''}\`;
                    
                    let input;
                    if (field.type === 'textarea') {
                        input = document.createElement('textarea');
                        input.rows = 4;
                    } else {
                        input = document.createElement('input');
                        input.type = field.type;
                    }
                    
                    input.id = field.id;
                    input.name = field.id;
                    input.className = 'mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
                    input.placeholder = field.placeholder;
                    
                    if (field.required) {
                        input.required = true;
                    }
                    
                    if (field.min) {
                        input.min = field.min;
                    }
                    
                    if (field.max) {
                        input.max = field.max;
                    }
                    
                    fieldDiv.appendChild(label);
                    fieldDiv.appendChild(input);
                    
                    if (field.validation && field.validation.message) {
                        const helpText = document.createElement('p');
                        helpText.className = 'text-xs text-gray-400 mt-1';
                        helpText.textContent = field.validation.message;
                        fieldDiv.appendChild(helpText);
                    }
                    
                    formFieldsContainer.appendChild(fieldDiv);
                });
                
            } catch (error) {
                console.error('Erro ao carregar configuração:', error);
                formFieldsContainer.innerHTML = \`<div class="text-red-500">Erro ao carregar formulário: \${error.message}</div>\`;
            }
            
            // Submeter formulário
            whitelistForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {};
                const formElements = Array.from(whitelistForm.elements);
                
                formElements.forEach(element => {
                    if (element.name && element.name !== '' && element.type !== 'submit') {
                        formData[element.name] = element.value;
                    }
                });
                
                try {
                    const response = await fetch('/api/submit', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': \`Bearer \${token}\`
                        },
                        body: JSON.stringify(formData)
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Erro ao enviar formulário');
                    }
                    
                    // Mostrar mensagem de sucesso
                    submitMessage.innerHTML = \`
                        <div class="bg-green-800 text-white p-4 rounded-md">
                            <h3 class="font-medium">Solicitação enviada com sucesso!</h3>
                            <p class="mt-2">Sua solicitação de whitelist foi enviada e está sendo analisada pela equipe. Você receberá uma notificação quando for aprovada ou rejeitada.</p>
                        </div>
                    \`;
                    submitMessage.classList.remove('hidden');
                    
                    // Desabilitar formulário
                    Array.from(whitelistForm.elements).forEach(element => {
                        if (element.type !== 'submit') {
                            element.disabled = true;
                        }
                    });
                    
                    // Esconder botão de envio
                    whitelistForm.querySelector('button[type="submit"]').classList.add('hidden');
                    
                } catch (error) {
                    console.error('Erro ao enviar formulário:', error);
                    
                    // Mostrar mensagem de erro
                    submitMessage.innerHTML = \`
                        <div class="bg-red-800 text-white p-4 rounded-md">
                            <h3 class="font-medium">Erro ao enviar solicitação</h3>
                            <p class="mt-2">\${error.message}</p>
                        </div>
                    \`;
                    submitMessage.classList.remove('hidden');
                }
            });
        });
    </script>
</body>
</html>`;
            fs.writeFileSync(formPath, formHtml);
            
            console.log('✅ Arquivos de frontend básicos criados');
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
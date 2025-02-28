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
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123', // Senha para painel admin (deve mudar!)
    sessionDuration: '24h', // Duração do token de sessão
    whitelistLinkDuration: 30, // Minutos que um link de convite de whitelist é válido
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
            id: 'motivo', 
            label: 'Por que você quer entrar?', 
            type: 'textarea', 
            required: true,
            placeholder: 'Explique por que você quer entrar no nosso servidor',
            validation: {
                minLength: 20,
                maxLength: 500,
                message: 'Motivo deve ter entre 20 e 500 caracteres'
            }
        }
        // Você pode adicionar mais campos conforme necessário
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
            admins: {}
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
        
        // Configurar senha admin se não existir
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
    }
    
    // Configura middleware do express
    setupMiddleware() {
        this.app.use(bodyParser.json());
        this.app.use(cors());
        
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
                // Informações públicas sobre o formulário
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
        
        // Processar envio de formulário
        this.app.post('/api/submit/:token', async (req, res) => {
            const { token } = req.params;
            const formData = req.body;
            
            if (!this.db.pendingLinks[token]) {
                return res.status(404).json({ error: 'Link inválido ou expirado' });
            }
            
            const link = this.db.pendingLinks[token];
            const now = new Date();
            const expiry = new Date(link.expiresAt);
            
            if (now > expiry) {
                delete this.db.pendingLinks[token];
                return res.status(400).json({ error: 'Link expirado' });
            }
            
            // Validar campos do formulário
            for (const field of this.options.formFields) {
                if (field.required && !formData[field.id]) {
                    return res.status(400).json({ error: `Campo ${field.label} é obrigatório` });
                }
                
                // Validação de tipo
                if (field.type === 'number' && formData[field.id]) {
                    const num = Number(formData[field.id]);
                    if (isNaN(num)) {
                        return res.status(400).json({ error: `Campo ${field.label} deve ser um número` });
                    }
                    if (field.min !== undefined && num < field.min) {
                        return res.status(400).json({ error: `Campo ${field.label} deve ser no mínimo ${field.min}` });
                    }
                    if (field.max !== undefined && num > field.max) {
                        return res.status(400).json({ error: `Campo ${field.label} deve ser no máximo ${field.max}` });
                    }
                }
                
                // Validação de padrão
                if (field.validation?.pattern && formData[field.id]) {
                    const regex = new RegExp(field.validation.pattern);
                    if (!regex.test(formData[field.id])) {
                        return res.status(400).json({ error: field.validation.message });
                    }
                }
                
                // Validação de tamanho para texto
                if ((field.type === 'text' || field.type === 'textarea') && formData[field.id]) {
                    if (field.validation?.minLength && formData[field.id].length < field.validation.minLength) {
                        return res.status(400).json({ error: field.validation.message });
                    }
                    if (field.validation?.maxLength && formData[field.id].length > field.validation.maxLength) {
                        return res.status(400).json({ error: field.validation.message });
                    }
                }
            }
            
            // Gerar ID único para o formulário
            const formId = uuidv4();
            
            // Adicionar dados do usuário e timestamps
            const newForm = {
                id: formId,
                userId: link.userId,
                username: link.username,
                discordTag: link.discordTag,
                guildId: link.guildId,
                status: 'pendente',
                data: formData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Salvar formulário
            this.db.forms[formId] = newForm;
            this.saveForms();
            
            // Remover link pendente
            delete this.db.pendingLinks[token];
            
            // Enviar notificação para o canal de logs
            this.notifyNewForm(newForm);
            
            res.json({ success: true, formId });
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
            
            // Notificar o usuário
            await this.notifyUser(form, status, feedback);
            
            res.json({ success: true, form });
        });
        
        // Rota de fallback - encaminha todas as outras rotas para o frontend
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'whitelist-frontend', 'index.html'));
        });
    }
    
    // Salva os formulários no arquivo
    saveForms() {
        const dbPath = path.join(__dirname, '..', 'database');
        const formsPath = path.join(dbPath, 'whitelist-forms.json');
        
        try {
            fs.writeFileSync(formsPath, JSON.stringify(this.db.forms, null, 2), 'utf-8');
        } catch (error) {
            console.error('Erro ao salvar formulários:', error);
        }
    }
    
    // Salva os administradores no arquivo
    saveAdmins() {
        const dbPath = path.join(__dirname, '..', 'database');
        const adminsPath = path.join(dbPath, 'whitelist-admins.json');
        
        try {
            fs.writeFileSync(adminsPath, JSON.stringify(this.db.admins, null, 2), 'utf-8');
        } catch (error) {
            console.error('Erro ao salvar administradores:', error);
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
                url: `http://localhost:${this.options.port}/admin/forms/${form.id}`
            };
            
            const actionRow = {
                type: 1, // ACTION_ROW
                components: [approveButton, rejectButton, adminButton]
            };
            
            // Enviar para o canal
            await logChannel.send({ embeds: [embed], components: [actionRow] });
            
            // Também registrar no novo sistema de logs
            if (logger && logger.logWhitelist) {
                logger.logWhitelist(logChannel, {
                    userId: form.userId,
                    username: form.username,
                    status: 'pendente',
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
                    const role = guild.roles.cache.find(r => r.name === 'Whitelisted');
                    
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
                        { name: 'ID do Formulário', value: form.id.substring(0, 8), inline: true }
                    )
                    .setTimestamp();
                    
                if (feedback) {
                    logEmbed.addFields({ name: 'Feedback', value: feedback });
                }
                
                await logChannel.send({ embeds: [logEmbed] });
                
                // Usar o novo sistema de logs também
                if (logger && logger.logWhitelist) {
                    logger.logWhitelist(logChannel, {
                        userId: form.userId,
                        username: form.username,
                        status,
                        approver: form.reviewedBy,
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
                return `http://localhost:${this.options.port}/whitelist/${token}`;
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
        
        return `http://localhost:${this.options.port}/whitelist/${token}`;
    }
    
    // Inicia o servidor HTTP
    start() {
        // Verificar diretório do frontend
        const frontendPath = path.join(__dirname, '..', 'whitelist-frontend');
        if (!fs.existsSync(frontendPath)) {
            fs.mkdirSync(frontendPath, { recursive: true });
            
            // Criar um arquivo index.html básico
            const indexPath = path.join(frontendPath, 'index.html');
            const basicHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Sistema de Whitelist</title>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body class="bg-gray-100">
                    <div class="min-h-screen flex items-center justify-center">
                        <div class="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
                            <h1 class="text-2xl font-bold text-center mb-6">Sistema de Whitelist</h1>
                            <p class="text-center text-gray-600">
                                Frontend em construção. Por favor, acesse através do Discord usando o comando /whitelist.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            fs.writeFileSync(indexPath, basicHtml);
            
            console.log('⚠️ Diretório do frontend criado com um arquivo HTML básico. Você deve implementar o frontend completo.');
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
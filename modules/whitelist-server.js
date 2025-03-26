const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { WebhookClient, EmbedBuilder } = require('discord.js');
const os = require('os');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const { Logger } = require('./logger');
const fetch = require('node-fetch');
const env = require('./env');
const config = require('../config/whitelist.config');

class WhitelistServer {
    constructor(client) {
        console.log('🔧 Inicializando servidor de whitelist...');
        
        // Verificar variáveis de ambiente
        this.checkEnvironmentVariables();
        
        this.client = client;
        this.app = express();
        this.logger = new Logger(client);
        this.db = {
            forms: {},
            admins: {},
            userLinks: {}
        };
        this.webhookClient = null;
        this.server = null;
        
        this.setupWebhook();
        this.setupMiddleware();
        this.setupRoutes();
        console.log('✅ Servidor de whitelist inicializado');
    }
    
    // Verificar variáveis de ambiente
    checkEnvironmentVariables() {
        const requiredVariables = [
            { name: 'WHITELIST_WEBHOOK_URL', value: env.WHITELIST_WEBHOOK_URL },
            { name: 'JWT_SECRET', value: env.JWT_SECRET },
            { name: 'ADMIN_USERNAME', value: env.ADMIN_USERNAME },
            { name: 'ADMIN_PASSWORD', value: env.ADMIN_PASSWORD },
            { name: 'ADMIN_JWT_SECRET', value: env.ADMIN_JWT_SECRET }
        ];
        
        console.log('📋 Verificando variáveis de ambiente:');
        
        const missingVars = requiredVariables.filter(v => !v.value);
        
        if (missingVars.length > 0) {
            const errorMsg = `Variáveis de ambiente obrigatórias ausentes: ${missingVars.map(v => v.name).join(', ')}`;
            console.error(`❌ ${errorMsg}`);
            throw new Error(errorMsg);
        }
        
        requiredVariables.forEach(variable => {
            console.log(`✅ Variável ${variable.name} configurada`);
        });
        
        console.log('📋 Configurações do servidor:');
        console.log(`- Porta: ${config.port}`);
        console.log(`- Host: ${config.host}`);
    }

    async setupWebhook() {
        try {
            console.log('Iniciando configuração do webhook...');

            // Verificar URL do webhook
            const webhookUrl = env.WHITELIST_WEBHOOK_URL;
            console.log(`URL do webhook: ${webhookUrl ? 'Configurada' : 'Não configurada'}`);
            
            // Validação do formato da URL do webhook
            const webhookRegex = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
            if (!webhookRegex.test(webhookUrl)) {
                const errorMsg = `URL do webhook inválida. Formato esperado: https://discord.com/api/webhooks/ID/TOKEN ou https://discordapp.com/api/webhooks/ID/TOKEN. Recebido: ${webhookUrl}`;
                console.error(`❌ ${errorMsg}`);
                await this.logger.logError(errorMsg, 'whitelist-webhook-setup');
                return false;
            }

            console.log('✅ URL do webhook válida');
            
            // Criar cliente de webhook
            this.webhookClient = new WebhookClient({ url: webhookUrl });
            
            // Verificar conexão com o webhook
            await this.testWebhook();
            console.log('✅ Webhook configurado com sucesso');
            return true;
        } catch (error) {
            console.error('❌ Erro ao configurar webhook:', error);
            await this.logger.logError(error, 'whitelist-webhook-setup');
            return false;
        }
    }

    async testWebhook() {
        if (!this.webhookClient) {
            throw new Error('Webhook não configurado');
        }
        
        try {
            // Enviar mensagem de teste
            await this.webhookClient.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🔄 Teste de Conexão')
                        .setDescription('O servidor de whitelist foi iniciado com sucesso')
                        .setColor('#3498db')
                        .setTimestamp()
                ]
            });
            return true;
        } catch (error) {
            console.error('❌ Erro ao testar webhook:', error);
            throw error;
        }
    }

    setupMiddleware() {
        console.log('⚙️ Configurando middleware...');
        
        // Middleware para CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-User-Token');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }
            next();
        });
        
        // Parser JSON com limite de tamanho
        this.app.use(express.json({ limit: '1mb' }));
        
        // Middleware para capturar IP
        this.app.use((req, res, next) => {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            req.clientIp = ip;
            next();
        });
        
        // Servir arquivos estáticos
        const frontendPath = path.join(__dirname, '..', 'whitelist-frontend');
        this.app.use(express.static(frontendPath));
        
        // Middleware de erro
        this.app.use(this.errorHandler.bind(this));
        
        console.log('✅ Middleware configurado');
    }

    setupRoutes() {
        console.log('🛣️ Configurando rotas...');
        
        // Rota principal
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'whitelist-frontend', 'index.html'));
        });

        // Rota para formulário com validação de token
        this.app.get('/form.html', (req, res) => {
            const token = req.query.token;
            if (!token) {
                console.log('❌ Token não fornecido');
                return res.redirect('/?error=no_token');
            }
            
            try {
                const decoded = jwt.verify(token, env.JWT_SECRET);
                console.log(`📄 Servindo formulário para usuário ${decoded.userId}`);
                
                // Verificar se já existe um formulário para este usuário
                const existingForm = Object.values(this.db.forms).find(f => f.userId === decoded.userId && f.status === 'pendente');
                if (existingForm) {
                    console.log(`⚠️ Usuário ${decoded.userId} já possui um formulário pendente`);
                    return res.redirect('/?error=already_submitted');
                }
                
                res.sendFile(path.join(__dirname, '..', 'whitelist-frontend', 'form.html'));
            } catch (error) {
                console.error('❌ Token inválido:', error);
                res.redirect('/?error=invalid_token');
            }
        });

        // Rota do painel admin
        this.app.get('/admin.html', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'whitelist-frontend', 'admin.html'));
        });

        // API Routes
        this.app.post('/api/whitelist/submit', this.validateUserToken.bind(this), this.handleWhitelistSubmit.bind(this));
        this.app.post('/api/whitelist/approve', this.authenticateToken.bind(this), this.handleWhitelistApprove.bind(this));
        this.app.post('/api/whitelist/reject', this.authenticateToken.bind(this), this.handleWhitelistReject.bind(this));
        this.app.get('/api/whitelist/forms', this.authenticateToken.bind(this), this.handleGetForms.bind(this));
        this.app.get('/api/whitelist/user/:userId', this.authenticateToken.bind(this), this.handleGetUserForm.bind(this));
        
        // Rotas de autenticação
        this.app.post('/api/admin/login', this.handleAdminLogin.bind(this));
        this.app.post('/api/admin/logout', (req, res) => {
            res.json({ success: true });
        });
        this.app.get('/api/admin/check-auth', this.authenticateToken.bind(this), (req, res) => {
            res.json({ authenticated: true });
        });
        
        console.log('✅ Rotas configuradas');
    }
    
    // Handler de Login do Admin
    handleAdminLogin(req, res) {
        console.log('\n🔐 Nova tentativa de login');
        
        // Validar se o corpo da requisição está correto
        if (!req.body || typeof req.body !== 'object') {
            console.log('❌ Corpo da requisição inválido');
            return res.status(400).json({ error: 'Corpo da requisição inválido' });
        }
        
        const { username, password } = req.body;
        
        // Validar se os campos foram enviados
        if (!username || !password) {
            console.log('❌ Campos obrigatórios não fornecidos');
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
        }
        
        console.log('📝 Dados recebidos:');
        console.log('- Usuário:', username);
        console.log('- Senha:', password ? 'Fornecida' : 'Não fornecida');
        
        // Validar se as variáveis de ambiente estão configuradas
        if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
            console.log('❌ Variáveis de ambiente não configuradas');
            return res.status(500).json({ error: 'Configuração do servidor incompleta' });
        }
        
        // Comparar credenciais
        const usernameMatch = username === env.ADMIN_USERNAME;
        const passwordMatch = password === env.ADMIN_PASSWORD;
        
        console.log('🔍 Validação:');
        console.log('- Usuário correto:', usernameMatch);
        console.log('- Senha correta:', passwordMatch);
        
        if (usernameMatch && passwordMatch) {
            console.log('✅ Login bem sucedido!');
            const token = jwt.sign({ 
                username,
                role: 'admin',
                permissions: ['manage_admins', 'view_logs', 'manage_whitelist', 'audit']
            }, env.ADMIN_JWT_SECRET, { expiresIn: '24h' });
            
            res.json({ 
                token,
                username,
                role: 'admin',
                permissions: ['manage_admins', 'view_logs', 'manage_whitelist', 'audit']
            });
        } else {
            console.log('❌ Login falhou: credenciais inválidas');
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    }

    validateUserToken(req, res, next) {
        const token = req.headers['x-user-token'];
        if (!token) {
            console.log('❌ Token não fornecido no header');
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        try {
            const decoded = jwt.verify(token, env.JWT_SECRET);
            console.log(`✅ Token válido para usuário ${decoded.userId}`);
            req.user = decoded;
            next();
        } catch (error) {
            console.error('❌ Token inválido:', error);
            return res.status(403).json({ error: 'Token inválido ou expirado' });
        }
    }
    
    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token não fornecido ou formato inválido' });
        }
        
        const token = authHeader.split(' ')[1];
        
        try {
            const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET);
            req.user = decoded;
            next();
        } catch (error) {
            console.error('❌ Erro ao verificar token de administrador:', error);
            return res.status(403).json({ error: 'Token inválido ou expirado' });
        }
    }

    async handleWhitelistSubmit(req, res) {
        try {
            const { nome, idade, estado, comoConheceu, religiao, discordUsername } = req.body;
            
            // Log para debug
            console.log('Dados recebidos:', req.body);
            
            // Validação de campos obrigatórios
            const requiredFields = ['nome', 'idade', 'estado', 'comoConheceu', 'religiao'];
            const missingFields = requiredFields.filter(field => !req.body[field]);
            
            if (missingFields.length > 0) {
                const errorMsg = `Campos obrigatórios ausentes: ${missingFields.join(', ')}`;
                console.error(`❌ ${errorMsg}`);
                return res.status(400).json({ error: errorMsg });
            }
            
            // Validações adicionais
            if (parseInt(idade) < 10 || parseInt(idade) > 100) {
                return res.status(400).json({ error: 'A idade deve estar entre 10 e 100 anos' });
            }
            
            // Verificar se o usuário já possui formulário pendente
            const userId = req.user?.id || 'ID não disponível';
            const username = req.user?.username || discordUsername || 'Usuário Anônimo';
            
            const pendingForms = Object.values(this.db.forms).filter(
                f => (f.userId === userId || f.discordUsername === username) && f.status === 'pendente'
            );
            
            if (pendingForms.length > 0) {
                console.log(`Usuário ${username} já possui formulário pendente`);
                return res.status(400).json({ error: 'Você já possui um formulário pendente de análise.' });
            }
            
            // Criar novo formulário
            const formId = uuid.v4();
            const form = {
                id: formId,
                userId,
                discordUsername: username,
                nome,
                idade: parseInt(idade),
                estado,
                comoConheceu,
                religiao,
                status: 'pendente',
                submittedAt: new Date().toISOString(),
                ip: req.clientIp
            };
            
            console.log('Criando novo formulário:', form);
            
            // Salvar no banco de dados
            this.db.forms[formId] = form;
            console.log('✅ Formulário salvo no banco de dados');
            
            // Enviar notificação para o Discord
            const embed = new EmbedBuilder()
                .setTitle('📝 Nova Solicitação de Whitelist')
                .setColor('#FFA500')
                .setDescription(`Nova solicitação de whitelist recebida de ${username}`)
                .addFields(
                    { name: 'Discord', value: `<@${userId}>`, inline: true },
                    { name: 'Nome', value: nome, inline: true },
                    { name: 'Idade', value: idade.toString(), inline: true },
                    { name: 'Estado', value: estado, inline: true },
                    { name: 'Como Conheceu', value: comoConheceu },
                    { name: 'Religião', value: religiao },
                    { name: 'IP', value: req.clientIp }
                )
                .setTimestamp()
                .setFooter({ text: `ID: ${formId}` });
            
            await this.sendWebhookNotification(embed);
            
            return res.status(200).json({ 
                message: 'Formulário enviado com sucesso! Sua solicitação será analisada em breve.',
                formId: formId
            });
        } catch (error) {
            console.error('❌ Erro ao processar formulário:', error);
            await this.logger.logError(error, 'whitelist-submit');
            res.status(500).json({ error: 'Erro interno ao processar o formulário. Tente novamente mais tarde.' });
        }
    }

    async handleWhitelistApprove(req, res) {
        try {
            const { formId } = req.body;
            const adminId = req.user.username;
            const form = this.db.forms[formId];

            if (!form) {
                console.log(`❌ Formulário ${formId} não encontrado`);
                return res.status(404).json({ error: 'Formulário não encontrado' });
            }

            form.status = 'aprovado';
            form.dataAprovacao = new Date().toISOString();
            form.aprovadoPor = adminId;

            // Adicionar cargo de whitelist ao usuário
            try {
                const member = await this.client.guilds.cache.first()?.members.fetch(form.userId);
                if (member) {
                    await member.roles.add(env.WHITELIST_ROLE_ID);
                    console.log(`✅ Cargo de whitelist adicionado para ${member.user.tag}`);
                }
            } catch (error) {
                console.error(`❌ Erro ao adicionar cargo: ${error.message}`);
            }

            // Enviar notificação via webhook
            if (this.webhookClient) {
                try {
                    const embed = new EmbedBuilder()
                        .setTitle('✅ Solicitação de Whitelist Aprovada')
                        .setColor('#00ff00')
                        .setDescription(`A solicitação de whitelist de ${form.discordUsername || form.nome} foi aprovada!`)
                        .addFields(
                            { name: 'Nome', value: form.nome, inline: true },
                            { name: 'Discord', value: `<@${form.userId}>`, inline: true },
                            { name: 'Aprovado por', value: adminId, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: `ID: ${formId}` });
                    
                    await this.webhookClient.send({ embeds: [embed] });
                    console.log('✅ Notificação de aprovação enviada via webhook');
                } catch (error) {
                    console.error('❌ Erro ao enviar notificação de aprovação:', error);
                }
            }

            res.json({ success: true, message: 'Solicitação aprovada com sucesso' });
        } catch (error) {
            console.error('❌ Erro ao aprovar solicitação:', error);
            res.status(500).json({ error: 'Erro ao aprovar solicitação' });
        }
    }

    async handleWhitelistReject(req, res) {
        try {
            const { formId, reason } = req.body;
            const adminId = req.user.username;
            const form = this.db.forms[formId];

            if (!form) {
                console.log(`❌ Formulário ${formId} não encontrado`);
                return res.status(404).json({ error: 'Formulário não encontrado' });
            }

            form.status = 'rejeitado';
            form.dataRejeicao = new Date().toISOString();
            form.rejeitadoPor = adminId;
            form.motivoRejeicao = reason;

            // Enviar notificação via webhook
            if (this.webhookClient) {
                try {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Solicitação de Whitelist Rejeitada')
                        .setColor('#ff0000')
                        .setDescription(`A solicitação de whitelist de ${form.discordUsername || form.nome} foi rejeitada.`)
                        .addFields(
                            { name: 'Nome', value: form.nome, inline: true },
                            { name: 'Discord', value: `<@${form.userId}>`, inline: true },
                            { name: 'Rejeitado por', value: adminId, inline: true },
                            { name: 'Motivo', value: reason || 'Nenhum motivo fornecido' }
                        )
                        .setTimestamp()
                        .setFooter({ text: `ID: ${formId}` });
                    
                    await this.webhookClient.send({ embeds: [embed] });
                    console.log('✅ Notificação de rejeição enviada via webhook');
                } catch (error) {
                    console.error('❌ Erro ao enviar notificação de rejeição:', error);
                }
            }

            res.json({ success: true, message: 'Solicitação rejeitada com sucesso' });
        } catch (error) {
            console.error('❌ Erro ao rejeitar solicitação:', error);
            res.status(500).json({ error: 'Erro ao rejeitar solicitação' });
        }
    }

    async handleGetForms(req, res) {
        try {
            const forms = Object.values(this.db.forms);
            res.json(forms);
        } catch (error) {
            console.error('❌ Erro ao buscar formulários:', error);
            res.status(500).json({ error: 'Erro ao buscar formulários' });
        }
    }

    async handleGetUserForm(req, res) {
        try {
            const { userId } = req.params;
            const form = Object.values(this.db.forms).find(f => f.userId === userId);
            
            if (!form) {
                return res.status(404).json({ error: 'Formulário não encontrado' });
            }
            
            res.json(form);
        } catch (error) {
            console.error('❌ Erro ao buscar formulário do usuário:', error);
            res.status(500).json({ error: 'Erro ao buscar formulário do usuário' });
        }
    }

    async start() {
        try {
            // Verificar variáveis de ambiente
            this.checkEnvironmentVariables();
            
            const port = config.port || env.PORT || 3000;
            console.log('🚀 Iniciando servidor na porta:', port);
            
            this.server = this.app.listen(port, () => {
                const localIP = this.getLocalIP();
                console.log('\n🌐 Servidor de whitelist rodando em:');
                console.log(`- Local: http://localhost:${port}`);
                console.log(`- IP: http://${localIP}:${port}`);
            });
            
            // Inicializar webhook após o servidor estar rodando
            await this.setupWebhook();
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao iniciar servidor de whitelist:', error);
            await this.logger.logError(error, 'whitelist-server-start');
            throw error;
        }
    }

    async stop() {
        try {
            if (this.server) {
                await new Promise((resolve) => this.server.close(resolve));
                console.log('✅ Servidor de whitelist parado com sucesso');
            }
        } catch (error) {
            console.error('❌ Erro ao parar servidor de whitelist:', error);
            throw error;
        }
    }

    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return 'localhost';
    }

    // Middleware para tratamento de erros
    errorHandler(err, req, res, next) {
        console.error('❌ Erro no servidor:', err);
        this.logger.logError(err, 'whitelist-server');
        res.status(500).json({ error: 'Erro interno do servidor' });
    }

    async sendWebhookNotification(embed) {
        if (!this.webhookClient) {
            console.warn('⚠️ Webhook não configurado, notificação não enviada');
            return false;
        }
        
        try {
            await this.webhookClient.send({ embeds: [embed] });
            console.log('✅ Notificação enviada para o Discord');
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação para o Discord:', error);
            await this.logger.logError(error, 'webhook-notification');
            return false;
        }
    }
}

module.exports = WhitelistServer;
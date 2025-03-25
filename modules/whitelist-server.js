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
            { name: 'JWT_SECRET', value: env.JWT_SECRET }
        ];
        
        console.log('📋 Verificando variáveis de ambiente:');
        
        let allValid = true;
        
        requiredVariables.forEach(variable => {
            if (!variable.value) {
                console.error(`❌ Variável de ambiente ${variable.name} não está configurada`);
                allValid = false;
            } else {
                console.log(`✅ Variável ${variable.name} configurada`);
            }
        });
        
        if (!allValid) {
            throw new Error('Variáveis de ambiente obrigatórias ausentes. Verifique o arquivo .env');
        }
        
        console.log('📋 Configurações do servidor:');
        console.log(`- Porta: ${config.port}`);
        console.log(`- Host: ${config.host}`);
        console.log(`- Webhook: ${env.WHITELIST_WEBHOOK_URL ? '✅ Configurado' : '❌ Não configurado'}`);
    }

    async setupWebhook() {
        try {
            console.log('Iniciando configuração do webhook...');
            this.checkEnvironmentVariables();

            // Verificar URL do webhook
            const webhookUrl = env.WHITELIST_WEBHOOK_URL;
            console.log(`URL do webhook: ${webhookUrl ? 'Configurada' : 'Não configurada'}`);
            
            // Validação do formato da URL do webhook
            const webhookRegex = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
            if (!webhookRegex.test(webhookUrl)) {
                const errorMsg = `URL do webhook inválida. 
                Formato esperado: https://discord.com/api/webhooks/ID/TOKEN ou https://discordapp.com/api/webhooks/ID/TOKEN. 
                Recebido: ${webhookUrl}`;
                console.error(`❌ ${errorMsg}`);
                await this.logger.logError(errorMsg, 'whitelist-webhook-setup');
                return false;
            }

            console.log('✅ URL do webhook válida');
            
            const discordWebhook = new WebhookClient({ url: webhookUrl });
            
            // Teste de conexão com o webhook
            await discordWebhook.sendTest();
            console.log('✅ Webhook configurado com sucesso');
            this.webhookClient = discordWebhook;
            return true;
        } catch (error) {
            console.error('❌ Erro ao configurar webhook:', error);
            await this.logger.logError(error, 'whitelist-webhook-setup');
            return false;
        }
    }

    setupMiddleware() {
        console.log('⚙️ Configurando middleware...');
        
        // Middleware para CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-User-Token');
            next();
        });
        
        this.app.use(express.json());
        
        // Verificar diretório de frontend
        const frontendPath = path.join(__dirname, '..', 'whitelist-frontend');
        console.log('📁 Diretório de frontend:', frontendPath);
        
        this.app.use(express.static(frontendPath));
        
        // Middleware para capturar IP
        this.app.use((req, res, next) => {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            req.clientIp = ip;
            next();
        });

        // Middleware de erro
        this.app.use((err, req, res, next) => {
            console.error('❌ Erro no servidor:', err);
            res.status(500).json({ error: 'Erro interno do servidor' });
        });

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
            return res.status(403).json({ error: 'Token inválido' });
        }
    }
    
    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }
        
        jwt.verify(token, env.ADMIN_JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'Token inválido' });
            }
            req.user = user;
            next();
        });
    }

    async handleWhitelistSubmit(req, res) {
        try {
            const { nome, idade, estado, comoConheceu, religiao, discordUsername } = req.body;
            
            // Log para debug
            console.log('Dados recebidos:', req.body);
            console.log('Headers:', req.headers);
            console.log('Informações do usuário:', req.user || 'Usuário não autenticado');
            
            // Validação de campos obrigatórios
            const requiredFields = ['nome', 'idade', 'estado', 'comoConheceu', 'religiao'];
            const missingFields = requiredFields.filter(field => !req.body[field]);
            
            if (missingFields.length > 0) {
                console.error(`❌ Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
                return res.status(400).json({ error: `Campos obrigatórios ausentes: ${missingFields.join(', ')}` });
            }
            
            // Verificar se o usuário já possui formulário pendente
            const username = req.user?.username || discordUsername || 'Usuário Anônimo';
            const userForms = Object.values(this.db.forms).filter(f => f.discord.username === username && f.status === 'pendente');
            
            if (userForms.length > 0) {
                const pendingForms = userForms.filter(form => form.status === 'pendente');
                if (pendingForms.length > 0) {
                    console.log(`Usuário ${username} já possui formulário pendente`);
                    return res.status(400).json({ error: 'Você já possui um formulário pendente de análise.' });
                }
            }
            
            // Criar novo formulário
            const formId = uuid.v4();
            const form = {
                id: formId,
                userId: req.user?.id || 'ID não disponível',
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
            if (this.webhookClient) {
                try {
                    await this.webhookClient.send({
                        content: `<@&${env.WHITELIST_ROLE_ID}> Nova solicitação de whitelist!`,
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('📝 Nova Solicitação de Whitelist')
                                .setColor('#FFA500')
                                .setDescription(`Nova solicitação de whitelist recebida de ${username}`)
                                .addFields(
                                    { name: 'Discord', value: `<@${req.user?.id}>`, inline: true },
                                    { name: 'Nome', value: nome, inline: true },
                                    { name: 'Idade', value: idade.toString(), inline: true },
                                    { name: 'Estado', value: estado, inline: true },
                                    { name: 'Como Conheceu', value: comoConheceu },
                                    { name: 'Religião', value: religiao },
                                    { name: 'IP', value: req.clientIp }
                                )
                                .setTimestamp()
                                .setFooter({ text: `ID: ${formId}` })
                        ]
                    });
                    console.log('✅ Notificação enviada para o Discord');
                } catch (error) {
                    console.error('❌ Erro ao enviar notificação para o Discord:', error);
                    console.error('Detalhes do erro:', error.message);
                }
            } else {
                console.warn('⚠️ Webhook não configurado, notificação não enviada');
            }
            
            return res.status(200).json({ 
                message: 'Formulário enviado com sucesso! Sua solicitação será analisada em breve.',
                formId: formId
            });
        } catch (error) {
            console.error('❌ Erro ao processar formulário:', error);
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
            const port = config.port || env.PORT || 3000;
            console.log('🚀 Iniciando servidor na porta:', port);
            console.log('📋 Variáveis de ambiente:');
            console.log('- ADMIN_USERNAME:', env.ADMIN_USERNAME);
            console.log('- ADMIN_PASSWORD:', env.ADMIN_PASSWORD ? 'Configurada' : 'Não configurada');
            console.log('- JWT_SECRET:', env.JWT_SECRET ? 'Configurado' : 'Não configurado');
            
            this.server = this.app.listen(port, () => {
                console.log('\n🌐 Servidor de whitelist rodando em:');
                console.log(`- Local: http://localhost:${port}`);
                console.log(`- IP: http://${this.getLocalIP()}:${port}`);
            });
        } catch (error) {
            console.error('❌ Erro ao iniciar servidor de whitelist:', error);
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
}

module.exports = WhitelistServer;
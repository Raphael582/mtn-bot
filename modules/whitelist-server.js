const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { WebhookClient, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../config/whitelist.config');
const os = require('os');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const { Logger } = require('./logger');
const fetch = require('node-fetch');
const env = require('./env');

// Logs de debug para variáveis de ambiente
console.log('\n🔍 Debug de variáveis de ambiente:');
console.log('ADMIN_USERNAME:', env.ADMIN_USERNAME);
console.log('ADMIN_PASSWORD:', env.ADMIN_PASSWORD ? 'Configurada' : 'Não configurada');
console.log('JWT_SECRET:', env.JWT_SECRET ? 'Configurado' : 'Não configurado');
console.log('Todas as variáveis de ambiente:', Object.keys(env).join(', '));

class WhitelistServer {
    constructor(client) {
        console.log('🔧 Inicializando servidor de whitelist...');
        console.log('📋 Verificando variáveis de ambiente:');
        console.log('- ADMIN_USERNAME:', env.ADMIN_USERNAME || '❌ Não configurado');
        console.log('- ADMIN_PASSWORD:', env.ADMIN_PASSWORD ? '✅ Configurada' : '❌ Não configurada');
        console.log('- JWT_SECRET:', env.JWT_SECRET ? '✅ Configurado' : '❌ Não configurado');
        console.log('- ADMIN_JWT_SECRET:', env.ADMIN_JWT_SECRET ? '✅ Configurado' : '❌ Não configurado');
        
        // Verificar variáveis obrigatórias
        if (!env.ADMIN_USERNAME) {
            console.error('❌ ADMIN_USERNAME não está configurado no .env');
            throw new Error('ADMIN_USERNAME não está configurado');
        }
        
        if (!env.ADMIN_PASSWORD) {
            console.error('❌ ADMIN_PASSWORD não está configurado no .env');
            throw new Error('ADMIN_PASSWORD não está configurado');
        }
        
        if (!env.ADMIN_JWT_SECRET) {
            console.error('❌ ADMIN_JWT_SECRET não está configurado no .env');
            throw new Error('ADMIN_JWT_SECRET não está configurado');
        }
        
        this.client = client;
        this.app = express();
        this.logger = new Logger(client);
        this.db = {
            forms: {},
            admins: {},
            userLinks: {} // Armazena os links únicos por usuário
        };
        this.webhookClient = null;
        this.server = null;
        
        // Verificar variáveis de ambiente
        console.log('📋 Configurações do servidor:');
        console.log('- Porta:', config.port);
        console.log('- Host:', config.host);
        console.log('- Webhook:', env.WHITELIST_WEBHOOK_URL ? '✅ Configurado' : '❌ Não configurado');
        
        this.setupWebhook();
        this.setupMiddleware();
        this.setupRoutes();
        console.log('✅ Servidor de whitelist inicializado');
    }

    async setupWebhook() {
        try {
            const webhookUrl = env.WHITELIST_WEBHOOK_URL;
            console.log('🔍 Verificando URL do webhook:');
            console.log('URL presente:', webhookUrl ? 'Sim' : 'Não');
            
            if (webhookUrl) {
                // Mostrar apenas o início da URL para debug
                const urlParts = webhookUrl.split('/');
                console.log('Formato da URL:', urlParts[0] + '//' + urlParts[2] + '/' + urlParts[3]);
                console.log('ID do Webhook:', urlParts[4]);
                console.log('Token:', urlParts[5].substring(0, 5) + '...');
            }
            
            if (!webhookUrl) {
                console.log('⚠️ Webhook não configurado');
                return;
            }

            // Validar formato da URL
            const webhookPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
            if (!webhookPattern.test(webhookUrl)) {
                console.error('❌ URL do webhook inválida. Formato esperado:');
                console.error('https://discord.com/api/webhooks/ID/TOKEN');
                console.error('URL atual:', webhookUrl);
                return;
            }

            console.log('🔗 Configurando webhook...');
            try {
                this.webhookClient = new WebhookClient({ 
                    url: webhookUrl
                });
                console.log('✅ Webhook configurado com sucesso');
                
                // Testar o webhook
                const testEmbed = new EmbedBuilder()
                    .setTitle('🔄 Teste de Webhook')
                    .setDescription('Webhook configurado com sucesso!')
                    .setColor('#00ff00')
                    .setTimestamp();
                
                await this.webhookClient.send({ embeds: [testEmbed] });
                console.log('✅ Teste de webhook enviado com sucesso');
            } catch (webhookError) {
                console.error('❌ Erro ao criar webhook:', webhookError);
                await this.logger.logError(webhookError, 'whitelist-webhook-creation');
            }
        } catch (error) {
            console.error('❌ Erro ao configurar webhook:', error);
            await this.logger.logError(error, 'whitelist-webhook-setup');
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
            console.log(`🌐 Requisição de ${ip}: ${req.method} ${req.url}`);
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
            console.log('📄 Servindo página principal');
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
            console.log('🔒 Servindo página de admin');
            res.sendFile(path.join(__dirname, '..', 'whitelist-frontend', 'admin.html'));
        });

        // API Routes
        this.app.post('/api/whitelist/submit', this.validateUserToken.bind(this), this.handleWhitelistSubmit.bind(this));
        this.app.post('/api/whitelist/approve', this.handleWhitelistApprove.bind(this));
        this.app.post('/api/whitelist/reject', this.handleWhitelistReject.bind(this));
        this.app.get('/api/whitelist/forms', this.handleGetForms.bind(this));
        this.app.get('/api/whitelist/user/:userId', this.handleGetUserForm.bind(this));
        
        // Rotas de autenticação
        this.app.post('/api/admin/login', (req, res) => {
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
        });

        this.app.post('/api/admin/logout', (req, res) => {
            res.json({ success: true });
        });

        this.app.get('/api/admin/check-auth', this.authenticateToken.bind(this), (req, res) => {
            res.json({ authenticated: true });
        });
        
        console.log('✅ Rotas configuradas');
    }

    validateUserToken(req, res, next) {
        const token = req.headers['x-user-token'];
        if (!token) {
            console.log('❌ Token não fornecido no header');
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        try {
            const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET);
            console.log(`✅ Token válido para usuário ${decoded.userId}`);
            req.user = decoded;
            next();
        } catch (error) {
            console.error('❌ Token inválido:', error);
            return res.status(403).json({ error: 'Token inválido' });
        }
    }

    async handleWhitelistSubmit(req, res) {
        try {
            console.log('\n📝 Nova submissão de whitelist');
            console.log('Dados recebidos:', req.body);
            
            const { nome, idade, estado, comoConheceu, religiao } = req.body;
            const userId = req.user.userId;
            
            // Validar campos obrigatórios
            const requiredFields = ['nome', 'idade', 'estado', 'comoConheceu', 'religiao'];
            const missingFields = requiredFields.filter(field => !req.body[field]);
            
            if (missingFields.length > 0) {
                console.log('❌ Campos obrigatórios faltando:', missingFields);
                return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
            }
            
            // Verificar se já existe um formulário pendente
            const existingForm = Object.values(this.db.forms).find(f => f.userId === userId && f.status === 'pendente');
            if (existingForm) {
                console.log(`⚠️ Usuário ${userId} já possui um formulário pendente`);
                return res.status(400).json({ error: 'Você já possui um formulário pendente' });
            }
            
            // Criar novo formulário
            const formId = uuid.v4();
            const form = {
                id: formId,
                userId,
                nome,
                idade,
                estado,
                comoConheceu,
                religiao,
                status: 'pendente',
                submittedAt: new Date().toISOString(),
                ip: req.clientIp
            };
            
            // Salvar no banco de dados
            this.db.forms[formId] = form;
            
            // Enviar notificação via webhook
            if (this.webhookClient) {
                try {
                    const embed = new EmbedBuilder()
                        .setTitle('📝 Nova Solicitação de Whitelist')
                        .setColor('#FFA500')
                        .addFields(
                            { name: 'Nome', value: nome },
                            { name: 'Idade', value: idade.toString() },
                            { name: 'Estado', value: estado },
                            { name: 'Como Conheceu', value: comoConheceu },
                            { name: 'Religião', value: religiao },
                            { name: 'ID do Usuário', value: userId },
                            { name: 'IP', value: req.clientIp }
                        )
                        .setTimestamp();
                    
                    await this.webhookClient.send({ embeds: [embed] });
                    console.log('✅ Notificação enviada via webhook');
                } catch (error) {
                    console.error('❌ Erro ao enviar notificação:', error);
                }
            }
            
            console.log('✅ Formulário salvo com sucesso');
            res.json({ success: true, message: 'Formulário enviado com sucesso' });
            
        } catch (error) {
            console.error('❌ Erro ao processar formulário:', error);
            res.status(500).json({ error: 'Erro ao processar formulário' });
        }
    }

    async handleWhitelistApprove(req, res) {
        try {
            const { formId, adminId } = req.body;
            const form = this.db.forms[formId];

            if (!form) {
                console.log(`❌ Formulário ${formId} não encontrado`);
                return res.status(404).json({ error: 'Formulário não encontrado' });
            }

            form.status = 'aprovado';
            form.dataAprovacao = new Date().toISOString();
            form.aprovadoPor = adminId;

            // Adicionar cargo de whitelist ao usuário
            const member = await this.client.guilds.cache.first()?.members.fetch(form.userId);
            if (member) {
                await member.roles.add(env.WHITELIST_ROLE_ID);
                console.log(`✅ Cargo de whitelist adicionado para ${member.user.tag}`);
            }

            // Enviar notificação para o Discord
            const webhookUrl = env.DISCORD_WEBHOOK_URL;
            if (webhookUrl) {
                const embed = new EmbedBuilder()
                    .setTitle('Solicitação de Whitelist Aprovada')
                    .setColor('#00ff00')
                    .addFields(
                        { name: 'Usuário', value: form.nome, inline: true },
                        { name: 'Discord', value: `<@${form.userId}>`, inline: true },
                        { name: 'Aprovado por', value: adminId, inline: true }
                    )
                    .setTimestamp();
                    
                await this.sendDiscordNotification(webhookUrl, embed);
            }

            res.json({ success: true, message: 'Solicitação aprovada com sucesso' });
        } catch (error) {
            console.error('❌ Erro ao aprovar solicitação:', error);
            res.status(500).json({ error: 'Erro ao aprovar solicitação' });
        }
    }

    async handleWhitelistReject(req, res) {
        try {
            const { formId, adminId, reason } = req.body;
            const form = this.db.forms[formId];

            if (!form) {
                console.log(`❌ Formulário ${formId} não encontrado`);
                return res.status(404).json({ error: 'Formulário não encontrado' });
            }

            form.status = 'rejeitado';
            form.dataRejeicao = new Date().toISOString();
            form.rejeitadoPor = adminId;
            form.motivoRejeicao = reason;

            // Remover cargo de whitelist do usuário se existir
            const member = await this.client.guilds.cache.first()?.members.fetch(form.userId);
            if (member) {
                await member.roles.remove(env.WHITELIST_ROLE_ID);
                console.log(`✅ Cargo de whitelist removido de ${member.user.tag}`);
            }

            // Enviar notificação para o Discord
            const webhookUrl = env.DISCORD_WEBHOOK_URL;
            if (webhookUrl) {
                const embed = new EmbedBuilder()
                    .setTitle('Solicitação de Whitelist Rejeitada')
                    .setColor('#ff0000')
                    .addFields(
                        { name: 'Usuário', value: form.nome, inline: true },
                        { name: 'Discord', value: `<@${form.userId}>`, inline: true },
                        { name: 'Rejeitado por', value: adminId, inline: true },
                        { name: 'Motivo', value: reason }
                    )
                    .setTimestamp();
                    
                await this.sendDiscordNotification(webhookUrl, embed);
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

    async sendDiscordNotification(webhookUrl, embed) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    embeds: [embed]
                })
            });
        } catch (error) {
            console.error('Erro ao enviar notificação para o Discord:', error);
        }
    }
}

module.exports = WhitelistServer;
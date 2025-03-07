const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { WebhookClient, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../config/whitelist.config');
const os = require('os');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const Logger = require('./logger');
const fetch = require('node-fetch');

class WhitelistServer {
    constructor(client) {
        console.log('🔧 Inicializando servidor de whitelist...');
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
        console.log('- URL:', config.server.url);
        console.log('- Webhook:', config.notifications.webhookEnabled ? 'Configurado' : 'Não configurado');
        
        this.setupWebhook();
        this.setupMiddleware();
        this.setupRoutes();
        console.log('✅ Servidor de whitelist inicializado');
    }

    async setupWebhook() {
        try {
            const webhookUrl = process.env.WHITELIST_WEBHOOK_URL;
            if (webhookUrl) {
                console.log('🔗 Configurando webhook...');
                this.webhookClient = new WebhookClient({ 
                    url: webhookUrl,
                    channelId: process.env.LOG_WHITELIST
                });
                console.log('✅ Webhook configurado');
            } else {
                console.log('⚠️ Webhook não configurado');
            }
        } catch (error) {
            console.error('❌ Erro ao configurar webhook:', error);
            await this.logger.logError(null, 'whitelist-webhook', error);
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
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
            const { username, password } = req.body;
            
            if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
                const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
                res.json({ token });
            } else {
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
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
            const { ...formData } = req.body;
            const userId = req.user.userId;
            
            console.log(`📝 Processando formulário para usuário ${userId}`);
            
            // Verificar se já existe um formulário para este usuário
            const existingForm = Object.values(this.db.forms).find(f => f.userId === userId && f.status === 'pendente');
            if (existingForm) {
                console.log(`⚠️ Usuário ${userId} já possui um formulário pendente`);
                return res.status(400).json({ error: 'Você já enviou uma solicitação' });
            }
            
            // Criar novo formulário
            const formId = uuid.v4();
            const form = {
                id: formId,
                userId,
                ...formData,
                status: 'pendente',
                createdAt: new Date().toISOString()
            };
            
            this.db.forms[formId] = form;
            console.log(`✅ Formulário criado com ID ${formId}`);
            
            // Enviar notificação para o Discord
            const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
            if (webhookUrl) {
                const embed = new EmbedBuilder()
                    .setTitle('Nova Solicitação de Whitelist')
                    .setColor('#3b82f6')
                    .addFields(
                        { name: 'Usuário', value: formData.nome, inline: true },
                        { name: 'Discord', value: `<@${userId}>`, inline: true },
                        { name: 'Estado', value: formData.estado, inline: true },
                        { name: 'Idade', value: formData.idade, inline: true },
                        { name: 'Experiência', value: formData.experiencia, inline: true },
                        { name: 'Motivação', value: formData.motivacao }
                    )
                    .setTimestamp();
                    
                await this.sendDiscordNotification(webhookUrl, embed);
            }
            
            res.json({
                success: true,
                message: 'Solicitação enviada com sucesso! Aguarde a análise da equipe.'
            });
        } catch (error) {
            console.error('❌ Erro ao processar formulário:', error);
            res.status(500).json({ error: 'Erro ao processar solicitação' });
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
                await member.roles.add(process.env.WHITELIST_ROLE_ID);
                console.log(`✅ Cargo de whitelist adicionado para ${member.user.tag}`);
            }

            // Enviar notificação para o Discord
            const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
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
                await member.roles.remove(process.env.WHITELIST_ROLE_ID);
                console.log(`✅ Cargo de whitelist removido de ${member.user.tag}`);
            }

            // Enviar notificação para o Discord
            const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
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
            this.server = this.app.listen(process.env.WHITELIST_PORT, () => {
                console.log('\n🌐 Servidor de whitelist rodando em:');
                console.log(`- Local: http://localhost:${process.env.WHITELIST_PORT}`);
                console.log(`- IP: http://${this.getLocalIP()}:${process.env.WHITELIST_PORT}`);
                console.log(`- URL: ${config.server.url}`);
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
        
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
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
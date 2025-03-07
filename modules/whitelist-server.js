const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { WebhookClient, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../config/whitelist.config');
const os = require('os');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');

class WhitelistServer {
    constructor(client) {
        console.log('🔧 Inicializando servidor de whitelist...');
        this.client = client;
        this.app = express();
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
        }
    }

    setupMiddleware() {
        console.log('⚙️ Configurando middleware...');
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
        this.app.get('/form', (req, res) => {
            const token = req.query.token;
            if (!token) {
                console.log('❌ Token não fornecido');
                return res.redirect('/');
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                console.log(`📄 Servindo formulário para usuário ${decoded.userId}`);
                
                // Verificar se já existe um formulário para este usuário
                const existingForm = Object.values(this.db.forms).find(f => f.userId === decoded.userId);
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
        this.app.get('/admin', (req, res) => {
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
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            next();
        } catch (error) {
            return res.status(403).json({ error: 'Token inválido' });
        }
    }

    async handleWhitelistSubmit(req, res) {
        try {
            const { ...formData } = req.body;
            const userId = req.user.userId;
            
            // Verificar se já existe um formulário para este usuário
            const existingForm = Object.values(this.db.forms).find(f => f.userId === userId);
            if (existingForm) {
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
            
            // Enviar notificação para o canal de whitelist
            const channel = this.client.channels.cache.get(process.env.LOG_WHITELIST);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('Nova Solicitação de Whitelist')
                    .setColor('#3b82f6')
                    .addFields(
                        { name: 'Nome', value: formData.nome },
                        { name: 'Idade', value: formData.idade },
                        { name: 'Estado', value: formData.estado },
                        { name: 'Como Conheceu', value: formData.comoConheceu },
                        { name: 'Religião', value: formData.religiao }
                    )
                    .setTimestamp();
                    
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`approve_${formId}`)
                            .setLabel('Aprovar')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`reject_${formId}`)
                            .setLabel('Rejeitar')
                            .setStyle(ButtonStyle.Danger)
                    );
                    
                channel.send({ embeds: [embed], components: [row] });
            }
            
            res.json({ success: true, formId });
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
                return res.status(404).json({ error: 'Formulário não encontrado' });
            }

            form.status = 'aprovado';
            form.dataAprovacao = new Date().toISOString();
            form.aprovadoPor = adminId;

            res.json({ success: true, message: 'Whitelist aprovada com sucesso!' });
        } catch (error) {
            console.error('❌ Erro ao aprovar whitelist:', error);
            res.status(500).json({ error: 'Erro ao aprovar whitelist' });
        }
    }

    async handleWhitelistReject(req, res) {
        try {
            const { formId, adminId, motivo } = req.body;
            const form = this.db.forms[formId];

            if (!form) {
                return res.status(404).json({ error: 'Formulário não encontrado' });
            }

            form.status = 'rejeitado';
            form.dataRejeicao = new Date().toISOString();
            form.rejeitadoPor = adminId;
            form.motivoRejeicao = motivo;

            res.json({ success: true, message: 'Whitelist rejeitada com sucesso!' });
        } catch (error) {
            console.error('❌ Erro ao rejeitar whitelist:', error);
            res.status(500).json({ error: 'Erro ao rejeitar whitelist' });
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
            
            if (form) {
                res.json({ exists: true, form });
            } else {
                res.json({ exists: false });
            }
        } catch (error) {
            console.error('❌ Erro ao buscar formulário do usuário:', error);
            res.status(500).json({ error: 'Erro ao buscar formulário' });
        }
    }

    async start() {
        try {
            const host = '0.0.0.0';
            const port = 3001;

            console.log('🚀 Iniciando servidor:', { host, port });
            
            return new Promise((resolve, reject) => {
                this.server = this.app.listen(port, host, async () => {
                    console.log(`✅ Servidor iniciado na porta ${port}`);
                    
                    // Testar se o servidor está respondendo
                    try {
                        const response = await fetch(`http://localhost:${port}`);
                        console.log('✅ Servidor respondendo corretamente');
                    } catch (error) {
                        console.error('❌ Erro ao testar servidor:', error);
                    }

                    const networkInterfaces = os.networkInterfaces();
                    const addresses = [];
                    
                    Object.keys(networkInterfaces).forEach((interfaceName) => {
                        networkInterfaces[interfaceName].forEach((iface) => {
                            if (iface.family === 'IPv4' && !iface.internal) {
                                addresses.push(iface.address);
                            }
                        });
                    });

                    console.log('\n🌐 Servidor de whitelist rodando em:');
                    console.log(`   http://localhost:${port}`);
                    addresses.forEach(ip => {
                        console.log(`   http://${ip}:${port}`);
                    });
                    console.log('\n💡 Dica: Use Ctrl+C para parar o servidor\n');
                    
                    resolve();
                }).on('error', (error) => {
                    console.error('❌ Erro ao iniciar servidor de whitelist:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('❌ Erro ao iniciar servidor de whitelist:', error);
            throw error;
        }
    }

    async stop() {
        try {
            if (this.server) {
                console.log('🛑 Parando servidor...');
                return new Promise((resolve, reject) => {
                    this.server.close((error) => {
                        if (error) {
                            console.error('❌ Erro ao parar servidor de whitelist:', error);
                            reject(error);
                        } else {
                            console.log('✅ Servidor de whitelist parado com sucesso');
                            resolve();
                        }
                    });
                });
            }
        } catch (error) {
            console.error('❌ Erro ao parar servidor de whitelist:', error);
            throw error;
        }
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
}

module.exports = WhitelistServer;
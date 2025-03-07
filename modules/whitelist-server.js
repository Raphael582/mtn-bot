const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { WebhookClient } = require('discord.js');
const config = require('../config/whitelist.config');
const os = require('os');

class WhitelistServer {
    constructor(client) {
        console.log('🔧 Inicializando servidor de whitelist...');
        this.client = client;
        this.app = express();
        this.db = {
            forms: {},
            admins: {}
        };
        this.webhookClient = null;
        this.server = null;
        this.portFile = path.join(__dirname, '..', '.whitelist-port');
        
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
                this.webhookClient = new WebhookClient({ url: webhookUrl });
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

        // Rota do painel admin
        this.app.get('/admin', (req, res) => {
            console.log('🔒 Servindo página de admin');
            res.sendFile(path.join(__dirname, '..', 'whitelist-frontend', 'admin.html'));
        });

        // API Routes
        this.app.post('/api/whitelist/submit', this.handleWhitelistSubmit.bind(this));
        this.app.post('/api/whitelist/approve', this.handleWhitelistApprove.bind(this));
        this.app.post('/api/whitelist/reject', this.handleWhitelistReject.bind(this));
        this.app.get('/api/whitelist/forms', this.handleGetForms.bind(this));
        
        console.log('✅ Rotas configuradas');
    }

    async handleWhitelistSubmit(req, res) {
        try {
            const form = req.body;
            const formsDb = this.db.forms;
            const clientIp = req.clientIp;

            // Validar campos obrigatórios
            const camposObrigatorios = ['nome', 'idade', 'comoConheceu', 'estado', 'religiao'];
            const camposFaltantes = camposObrigatorios.filter(campo => !form[campo]);
            
            if (camposFaltantes.length > 0) {
                return res.status(400).json({ 
                    error: 'Campos obrigatórios não preenchidos',
                    campos: camposFaltantes
                });
            }

            // Salvar formulário
            const formId = Date.now().toString();
            formsDb[formId] = {
                ...form,
                id: formId,
                status: 'pendente',
                dataEnvio: new Date().toISOString(),
                ip: clientIp
            };

            // Notificar via webhook
            if (this.webhookClient) {
                await this.webhookClient.send({
                    embeds: [{
                        title: '📝 Nova Solicitação de Whitelist',
                        description: `Usuário **${form.nome}** enviou um formulário de whitelist pelo site.`,
                        color: 0x3498db,
                        fields: [
                            { name: 'Nome', value: form.nome, inline: true },
                            { name: 'Idade', value: form.idade, inline: true },
                            { name: 'Estado', value: form.estado, inline: true },
                            { name: 'Como Conheceu', value: form.comoConheceu, inline: true },
                            { name: 'Religião', value: form.religiao, inline: true },
                            { name: 'IP', value: clientIp, inline: true }
                        ],
                        timestamp: new Date()
                    }]
                });
            }

            res.json({ success: true, message: 'Formulário enviado com sucesso!' });
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

    async findAvailablePort(startPort, endPort) {
        const net = require('net');
        
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    // Porta está em uso, tenta a próxima
                    server.close();
                    if (startPort < endPort) {
                        this.findAvailablePort(startPort + 1, endPort)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        reject(new Error('Nenhuma porta disponível encontrada'));
                    }
                } else {
                    reject(err);
                }
            });

            server.listen(startPort, () => {
                const port = server.address().port;
                server.close(() => resolve(port));
            });
        });
    }

    async updateNginxConfig(port) {
        try {
            const nginxConfig = `
server {
    listen 80;
    server_name 56.124.64.115;

    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}`;

            // Salvar a porta atual
            await fs.writeFile(this.portFile, port.toString());
            console.log('💾 Porta salva:', port);

            // Salvar configuração do Nginx
            await fs.writeFile('/etc/nginx/sites-available/whitelist.conf', nginxConfig);
            console.log('💾 Configuração do Nginx atualizada');

            // Testar configuração do Nginx
            const { exec } = require('child_process');
            exec('sudo nginx -t', (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Erro ao testar configuração do Nginx:', error);
                    return;
                }
                console.log('✅ Configuração do Nginx testada com sucesso');

                // Reiniciar Nginx
                exec('sudo systemctl restart nginx', (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ Erro ao reiniciar Nginx:', error);
                        return;
                    }
                    console.log('✅ Nginx reiniciado com sucesso');
                });
            });
        } catch (error) {
            console.error('❌ Erro ao atualizar configuração do Nginx:', error);
        }
    }

    async start() {
        try {
            const host = config.server.useLocalhost ? 'localhost' : '0.0.0.0';
            let port;

            if (config.server.port.specific) {
                // Tenta usar a porta específica
                try {
                    port = await this.findAvailablePort(
                        config.server.port.specific,
                        config.server.port.specific
                    );
                } catch (error) {
                    console.log('⚠️ Porta específica em uso, usando porta aleatória...');
                    port = await this.findAvailablePort(
                        config.server.port.min,
                        config.server.port.max
                    );
                }
            } else {
                // Usa porta aleatória
                port = await this.findAvailablePort(
                    config.server.port.min,
                    config.server.port.max
                );
            }

            console.log('🚀 Iniciando servidor:', { host, port });
            
            return new Promise((resolve, reject) => {
                this.server = this.app.listen(port, host, async () => {
                    const networkInterfaces = os.networkInterfaces();
                    const addresses = [];
                    
                    // Coletar todos os IPs disponíveis
                    Object.keys(networkInterfaces).forEach((interfaceName) => {
                        networkInterfaces[interfaceName].forEach((interface) => {
                            if (interface.family === 'IPv4' && !interface.internal) {
                                addresses.push(interface.address);
                            }
                        });
                    });

                    console.log('\n🌐 Servidor de whitelist rodando em:');
                    console.log(`   http://localhost:${port}`);
                    addresses.forEach(ip => {
                        console.log(`   http://${ip}:${port}`);
                    });
                    console.log('\n💡 Dica: Use Ctrl+C para parar o servidor\n');

                    // Atualizar configuração do Nginx
                    await this.updateNginxConfig(port);
                    
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
}

module.exports = WhitelistServer;
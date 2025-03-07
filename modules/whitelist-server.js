const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { WebhookClient } = require('discord.js');

class WhitelistServer {
    constructor(client) {
        this.client = client;
        this.app = express();
        this.db = {
            forms: {},
            admins: {}
        };
        this.webhookClient = null;
        this.setupWebhook();
        this.setupMiddleware();
        this.setupRoutes();
    }

    async setupWebhook() {
        try {
            const webhookUrl = process.env.WHITELIST_WEBHOOK_URL;
            if (webhookUrl) {
                this.webhookClient = new WebhookClient({ url: webhookUrl });
            }
        } catch (error) {
            console.error('❌ Erro ao configurar webhook:', error);
        }
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '..', 'whitelist-frontend')));
        
        // Middleware para capturar IP
        this.app.use((req, res, next) => {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            req.clientIp = ip;
            next();
        });
    }

    setupRoutes() {
        // Rota principal
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'whitelist-frontend', 'index.html'));
        });

        // Rota do painel admin
        this.app.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'whitelist-frontend', 'admin.html'));
        });

        // API Routes
        this.app.post('/api/whitelist/submit', this.handleWhitelistSubmit.bind(this));
        this.app.post('/api/whitelist/approve', this.handleWhitelistApprove.bind(this));
        this.app.post('/api/whitelist/reject', this.handleWhitelistReject.bind(this));
        this.app.get('/api/whitelist/forms', this.handleGetForms.bind(this));
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

    async start() {
        try {
            const port = process.env.WHITELIST_PORT || 5000;
            this.app.listen(port, () => {
                console.log(`✅ Servidor de whitelist rodando na porta ${port}`);
            });
        } catch (error) {
            console.error('❌ Erro ao iniciar servidor de whitelist:', error);
            throw error;
        }
    }

    async stop() {
        try {
            // Implementar lógica de parada do servidor
            console.log('✅ Servidor de whitelist parado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao parar servidor de whitelist:', error);
            throw error;
        }
    }
}

module.exports = WhitelistServer;
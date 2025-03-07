const { WebhookClient } = require('discord.js');
const config = require('../config/whitelist.config');

class DiscordWebhook {
    constructor() {
        this.webhook = null;
        this.initialize();
    }

    initialize() {
        if (config.notifications.webhook.enabled && config.notifications.webhook.url) {
            try {
                this.webhook = new WebhookClient({ url: config.notifications.webhook.url });
                console.log('✅ Webhook do Discord inicializado com sucesso');
            } catch (error) {
                console.error('❌ Erro ao inicializar webhook do Discord:', error);
            }
        } else {
            console.log('⚠️ Webhook do Discord desativado');
        }
    }

    async sendWhitelistNotification(form) {
        if (!this.webhook) return;

        try {
            const embed = {
                title: '📝 Nova Solicitação de Whitelist',
                color: 0x3b82f6,
                fields: [
                    {
                        name: 'Nome',
                        value: form.nome,
                        inline: true
                    },
                    {
                        name: 'Idade',
                        value: form.idade,
                        inline: true
                    },
                    {
                        name: 'Estado',
                        value: form.estado,
                        inline: true
                    },
                    {
                        name: 'Como Conheceu',
                        value: form.comoConheceu,
                        inline: true
                    },
                    {
                        name: 'Religião',
                        value: form.religiao,
                        inline: true
                    },
                    {
                        name: 'ID do Discord',
                        value: form.discord_id || 'Não informado',
                        inline: true
                    },
                    {
                        name: 'IP',
                        value: form.ip || 'Não informado',
                        inline: true
                    },
                    {
                        name: 'Data',
                        value: new Date(form.created_at).toLocaleString('pt-BR'),
                        inline: true
                    }
                ],
                footer: {
                    text: `ID: ${form.id}`
                }
            };

            await this.webhook.send({ embeds: [embed] });
            console.log('✅ Notificação de whitelist enviada com sucesso');
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de whitelist:', error);
        }
    }

    async sendStatusUpdateNotification(form, adminUsername) {
        if (!this.webhook) return;

        try {
            const embed = {
                title: '🔄 Atualização de Status - Whitelist',
                color: form.status === 'aprovado' ? 0x10b981 : 0xef4444,
                fields: [
                    {
                        name: 'Nome',
                        value: form.nome,
                        inline: true
                    },
                    {
                        name: 'Status',
                        value: form.status.charAt(0).toUpperCase() + form.status.slice(1),
                        inline: true
                    },
                    {
                        name: 'Admin',
                        value: adminUsername,
                        inline: true
                    },
                    {
                        name: 'Data',
                        value: new Date(form.updated_at).toLocaleString('pt-BR'),
                        inline: true
                    }
                ],
                footer: {
                    text: `ID: ${form.id}`
                }
            };

            await this.webhook.send({ embeds: [embed] });
            console.log('✅ Notificação de atualização de status enviada com sucesso');
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de atualização de status:', error);
        }
    }

    async sendAdminNotification(action, adminData) {
        if (!this.webhook) return;

        try {
            const embed = {
                title: '👑 Atualização de Administradores',
                color: 0x8b5cf6,
                fields: [
                    {
                        name: 'Ação',
                        value: action,
                        inline: true
                    },
                    {
                        name: 'Usuário',
                        value: adminData.username,
                        inline: true
                    },
                    {
                        name: 'Cargo',
                        value: adminData.role.charAt(0).toUpperCase() + adminData.role.slice(1),
                        inline: true
                    },
                    {
                        name: 'Criado por',
                        value: adminData.created_by,
                        inline: true
                    },
                    {
                        name: 'Data',
                        value: new Date(adminData.created_at).toLocaleString('pt-BR'),
                        inline: true
                    }
                ],
                footer: {
                    text: `ID: ${adminData.id}`
                }
            };

            await this.webhook.send({ embeds: [embed] });
            console.log('✅ Notificação de admin enviada com sucesso');
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de admin:', error);
        }
    }
}

module.exports = new DiscordWebhook(); 
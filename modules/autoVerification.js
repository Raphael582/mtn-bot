const { Client, GatewayIntentBits } = require('discord.js');
const dataManager = require('./dataManager');
const { DISCORD_TOKEN, WHITELIST_ROLE_ID } = process.env;

class AutoVerification {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.client.login(DISCORD_TOKEN);
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.on('ready', () => {
            console.log('Sistema de verificação automática iniciado');
            this.startVerificationLoop();
        });

        // Verificar quando um membro entra no servidor
        this.client.on('guildMemberAdd', async (member) => {
            await this.verifyMember(member);
        });
    }

    async verifyMember(member) {
        try {
            const request = await dataManager.getUserRequest(member.id);
            if (request && request.status === 'aprovado') {
                await member.roles.add(WHITELIST_ROLE_ID);
                console.log(`Cargo de whitelist adicionado automaticamente para ${member.user.tag}`);
            }
        } catch (error) {
            console.error('Erro ao verificar membro:', error);
        }
    }

    async startVerificationLoop() {
        setInterval(async () => {
            try {
                const requests = await dataManager.getAllRequests();
                const guild = await this.client.guilds.fetch(process.env.GUILD_ID);
                
                for (const request of requests) {
                    if (request.status === 'aprovado') {
                        const member = await guild.members.fetch(request.userId).catch(() => null);
                        if (member && !member.roles.cache.has(WHITELIST_ROLE_ID)) {
                            await member.roles.add(WHITELIST_ROLE_ID);
                            console.log(`Cargo de whitelist adicionado automaticamente para ${member.user.tag}`);
                        }
                    }
                }
            } catch (error) {
                console.error('Erro na verificação automática:', error);
            }
        }, 5 * 60 * 1000); // Verificar a cada 5 minutos
    }

    async removeWhitelist(userId, reason) {
        try {
            const guild = await this.client.guilds.fetch(process.env.GUILD_ID);
            const member = await guild.members.fetch(userId);
            
            // Remover cargo
            await member.roles.remove(WHITELIST_ROLE_ID);
            
            // Notificar usuário
            await member.send({
                embeds: [{
                    title: 'Whitelist Removida',
                    description: `Sua whitelist foi removida pelo seguinte motivo:\n${reason}`,
                    color: 0xFF0000
                }]
            }).catch(() => console.log('Não foi possível enviar DM para o usuário'));

            // Atualizar status no banco de dados
            await dataManager.updateWhitelistRequest(userId, 'rejeitado', reason);
            
            console.log(`Whitelist removida para ${member.user.tag}`);
        } catch (error) {
            console.error('Erro ao remover whitelist:', error);
        }
    }
}

module.exports = new AutoVerification(); 
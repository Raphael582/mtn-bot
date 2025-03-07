const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

class Logger {
    constructor(client) {
        this.client = client;
        this.logLevels = {
            INFO: { color: 0x3498db, emoji: 'ℹ️', channelName: 'logs' },
            SUCCESS: { color: 0x2ecc71, emoji: '✅', channelName: 'logs' },
            WARNING: { color: 0xf39c12, emoji: '⚠️', channelName: 'logs' },
            ERROR: { color: 0xe74c3c, emoji: '❌', channelName: 'logs' },
            FILTER: { color: 0x9b59b6, emoji: '🔍', channelName: 'logs-filtro' },
            PUNISH: { color: 0xe67e22, emoji: '🚫', channelName: 'logs-punicoes' },
            WHITELIST: { color: 0x1abc9c, emoji: '📝', channelName: 'logs-whitelist' },
            ORACULO: { color: 0x9b59b6, emoji: '🔮', channelName: 'logs-oraculo' }
        };
        this.ensureLogChannels();
    }

    async ensureLogChannels() {
        const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            console.error('❌ Servidor não encontrado');
            return;
        }

        const logChannels = {
            LOG_ORACULO: 'logs-oraculo',
            LOG_FILTRO: 'logs-filtro',
            LOG_CHAT: 'logs',
            LOG_PUNICOES: 'logs-punicoes',
            LOG_WHITELIST: 'logs-whitelist'
        };

        for (const [envVar, channelName] of Object.entries(logChannels)) {
            const channelId = process.env[envVar];
            if (!channelId) {
                console.log(`⚠️ ID do canal ${channelName} não configurado, buscando por nome...`);
                const channel = guild.channels.cache.find(c => c.name === channelName);
                if (!channel) {
                    console.error(`❌ Canal ${channelName} não encontrado`);
                    continue;
                }
                console.log(`✅ Canal ${channelName} encontrado por nome`);
                continue;
            }

            const channel = guild.channels.cache.get(channelId);
            if (!channel) {
                console.error(`❌ Canal ${channelName} não encontrado pelo ID`);
                continue;
            }

            console.log(`✅ Canal ${channelName} verificado com sucesso`);
        }
    }

    async getLogChannel(level) {
        const logLevel = this.logLevels[level];
        if (!logLevel) {
            console.error(`❌ Nível de log ${level} não encontrado`);
            return null;
        }

        const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            console.error('❌ Servidor não encontrado');
            return null;
        }

        // Tentar encontrar o canal pelo ID primeiro
        const channelId = process.env[`LOG_${level}`];
        if (channelId) {
            const channel = guild.channels.cache.get(channelId);
            if (channel) {
                return channel;
            }
        }

        // Se não encontrar pelo ID, buscar por nome
        const channel = guild.channels.cache.find(c => c.name === logLevel.channelName);
        if (!channel) {
            console.error(`❌ Canal ${logLevel.channelName} não encontrado`);
            return null;
        }

        return channel;
    }

    async log(level, title, description, fields = [], options = {}) {
        try {
            const logLevel = this.logLevels[level] || this.logLevels.INFO;
            const channel = await this.getLogChannel(level);
            
            if (!channel) {
                console.error(`❌ Não foi possível enviar log ${level}: Canal não encontrado`);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(logLevel.color)
                .setTitle(`${logLevel.emoji} ${title}`)
                .setDescription(description)
                .setTimestamp();

            if (fields && fields.length > 0) {
                embed.addFields(fields);
            }

            if (options.footer) {
                embed.setFooter({ text: options.footer });
            }

            if (options.author) {
                embed.setAuthor(options.author);
            }

            if (options.thumbnail) {
                embed.setThumbnail(options.thumbnail);
            }

            await channel.send({ embeds: [embed] });
            await this.saveToFile(level, {
                title,
                description,
                fields,
                options,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error(`❌ Erro ao enviar log ${level}:`, error);
        }
    }

    async saveToFile(level, data) {
        try {
            const logsDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }

            const date = new Date();
            const fileName = `${level.toLowerCase()}_${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}.json`;
            const filePath = path.join(logsDir, fileName);

            let logs = [];
            if (fs.existsSync(filePath)) {
                try {
                    logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                } catch (error) {
                    console.error('Erro ao ler arquivo de logs:', error);
                }
            }

            logs.push(data);
            fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('Erro ao salvar log em arquivo:', error);
        }
    }

    async logFilter(message, reason) {
        await this.log('FILTER', 'Mensagem Filtrada', 
            `Uma mensagem foi filtrada no canal ${message.channel.name}`,
            [
                { name: 'Usuário', value: message.author.tag, inline: true },
                { name: 'Canal', value: message.channel.name, inline: true },
                { name: 'Motivo', value: reason }
            ],
            {
                author: { name: message.author.tag, iconURL: message.author.displayAvatarURL() }
            }
        );
    }

    async logPunishment(user, type, reason, moderator) {
        await this.log('PUNISH', 'Punição Aplicada',
            `Uma punição foi aplicada ao usuário ${user.tag}`,
            [
                { name: 'Usuário', value: user.tag, inline: true },
                { name: 'Tipo', value: type, inline: true },
                { name: 'Moderador', value: moderator.tag, inline: true },
                { name: 'Motivo', value: reason }
            ],
            {
                author: { name: moderator.tag, iconURL: moderator.displayAvatarURL() }
            }
        );
    }

    async logWhitelist(user, status, moderator = null) {
        await this.log('WHITELIST', 'Status da Whitelist',
            `A whitelist do usuário ${user.tag} foi ${status}`,
            [
                { name: 'Usuário', value: user.tag, inline: true },
                { name: 'Status', value: status, inline: true }
            ].concat(moderator ? [{ name: 'Moderador', value: moderator.tag, inline: true }] : []),
            {
                author: { name: user.tag, iconURL: user.displayAvatarURL() }
            }
        );
    }

    async logError(error, context) {
        await this.log('ERROR', 'Erro no Sistema',
            `Um erro ocorreu no sistema: ${context}`,
            [
                { name: 'Mensagem', value: error.message },
                { name: 'Stack', value: `\`\`\`\n${error.stack}\n\`\`\`` }
            ]
        );
    }
}

module.exports = Logger;
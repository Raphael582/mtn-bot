const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

class Logger {
    constructor(client) {
        this.client = client;
        this.logLevels = {
            INFO: { color: 0x3498db, emoji: 'ℹ️' },
            SUCCESS: { color: 0x2ecc71, emoji: '✅' },
            WARNING: { color: 0xf39c12, emoji: '⚠️' },
            ERROR: { color: 0xe74c3c, emoji: '❌' },
            FILTER: { color: 0x9b59b6, emoji: '🔍' },
            PUNISH: { color: 0xe67e22, emoji: '🚫' },
            WHITELIST: { color: 0x1abc9c, emoji: '📝' }
        };
    }

    async log(level, title, description, fields = [], options = {}) {
        const logLevel = this.logLevels[level] || this.logLevels.INFO;
        const channelId = process.env[`LOG_${level}`] || process.env.LOG_CHAT;

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

        const channel = this.client.channels.cache.get(channelId);
        if (channel) {
            await channel.send({ embeds: [embed] });
        }

        // Salvar log em arquivo
        this.saveToFile(level, {
            title,
            description,
            fields,
            options,
            timestamp: new Date().toISOString()
        });
    }

    saveToFile(level, data) {
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
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const env = require('./env');
const winston = require('winston');
const config = require('../config/server.config');

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
        
        // Aguardar o bot estar pronto antes de configurar os canais
        this.client.once('ready', () => {
            console.log('🤖 Bot está pronto, configurando canais de log...');
            this.ensureLogChannels();
        });
    }

    async ensureLogChannels() {
        console.log('\n🔍 Verificando canais de log...');
        console.log('GUILD_ID:', process.env.GUILD_ID);
        
        const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            console.error('❌ Servidor não encontrado!');
            console.log('Servidores disponíveis:', this.client.guilds.cache.map(g => `${g.name} (${g.id})`).join(', '));
            return;
        }
        
        console.log(`✅ Servidor encontrado: ${guild.name} (${guild.id})`);
        console.log('Canais disponíveis:', guild.channels.cache.map(c => `${c.name} (${c.id})`).join(', '));
        
        const logChannels = {
            oraculo: process.env.LOG_ORACULO,
            filtro: process.env.LOG_FILTRO,
            chat: process.env.LOG_CHAT,
            punicoes: process.env.LOG_PUNICOES,
            whitelist: process.env.LOG_WHITELIST
        };
        
        console.log('\n📋 IDs dos canais de log configurados:');
        for (const [name, id] of Object.entries(logChannels)) {
            const channel = guild.channels.cache.get(id);
            console.log(`${name.toUpperCase()}: ${id} - ${channel ? '✅ Encontrado' : '❌ Não encontrado'}`);
            if (channel) {
                console.log(`  Nome: ${channel.name}`);
                console.log(`  Tipo: ${channel.type}`);
                console.log(`  Permissões: ${channel.permissionsFor(guild.members.me).has('SendMessages') ? '✅ Pode enviar mensagens' : '❌ Não pode enviar mensagens'}`);
            }
        }
    }

    async getLogChannel(level) {
        try {
            const logLevel = this.logLevels[level];
            if (!logLevel) {
                console.error(`❌ Nível de log ${level} não encontrado`);
                return null;
            }

            // Verificar se o cliente está disponível e pronto
            if (!this.client || !this.client.isReady()) {
                console.error('❌ Cliente Discord não está pronto para enviar logs');
                return null;
            }

            const guild = this.client.guilds.cache.get(env.GUILD_ID);
            if (!guild) {
                console.error('❌ Servidor não encontrado');
                return null;
            }

            // Tentar encontrar o canal pelo ID primeiro
            const channelId = env[`LOG_${level}`];
            if (channelId) {
                const channel = guild.channels.cache.get(channelId);
                if (channel && channel.isTextBased()) {
                    return channel;
                }
            }

            // Se não encontrar pelo ID, buscar por nome
            const channel = guild.channels.cache.find(c => c.name === logLevel.channelName && c.isTextBased());
            if (!channel) {
                console.error(`❌ Canal ${logLevel.channelName} não encontrado`);
                return null;
            }

            return channel;
        } catch (error) {
            console.error('❌ Erro ao obter canal de log:', error);
            return null;
        }
    }

    async log(level, title, description, fields = [], options = {}) {
        try {
            const logLevel = this.logLevels[level] || this.logLevels.INFO;
            
            // Informações básicas para arquivo de log
            const logData = {
                level,
                title,
                description,
                fields,
                options,
                timestamp: new Date().toISOString()
            };
            
            // Tentar enviar para o Discord
            const channel = await this.getLogChannel(level);
            if (channel) {
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
            } else {
                // Se não conseguir enviar para o Discord, registrar no console
                console.log(`📝 [${level}] ${title}: ${description}`);
            }
            
            // Sempre salvar em arquivo como fallback
            await this.saveToFile(level, logData);
        } catch (error) {
            console.error(`❌ Erro ao enviar log ${level}:`, error);
            
            // Tentar salvar no arquivo mesmo se falhar envio ao Discord
            try {
                await this.saveToFile(level, {
                    title,
                    description,
                    fields,
                    options,
                    timestamp: new Date().toISOString(),
                    error: error.message
                });
            } catch (fileError) {
                console.error('❌ Erro crítico ao salvar log em arquivo:', fileError);
            }
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
                    const fileContent = await fs.promises.readFile(filePath, 'utf8');
                    logs = JSON.parse(fileContent);
                } catch (readError) {
                    console.error('Erro ao ler arquivo de logs:', readError);
                    // Criar arquivo novo se houver corrupção
                }
            }

            // Adicionar o novo log
            logs.push(data);
            
            // Limitar o tamanho do arquivo (manter últimos 1000 logs)
            if (logs.length > 1000) {
                logs = logs.slice(-1000);
            }
            
            // Escrever de forma assíncrona
            await fs.promises.writeFile(filePath, JSON.stringify(logs, null, 2));
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
        try {
            // Garantir que temos uma mensagem de erro e stack trace mesmo se error for null
            const errorMessage = error ? error.message : 'Erro desconhecido';
            const errorStack = error ? error.stack : 'Stack trace não disponível';
            
            // Informações adicionais do erro
            const details = {
                context,
                timestamp: new Date().toISOString(),
                errorType: error ? error.constructor.name : 'Unknown',
                errorMessage,
                errorStack
            };
            
            // Registrar no console para debug imediato
            console.error(`❌ [ERRO] [${context}]: ${errorMessage}`);
            
            // Tentar enviar para o canal de logs Discord
            try {
                await this.log('ERROR', 'Erro no Sistema',
                    `Um erro ocorreu no contexto: ${context}`,
                    [
                        { name: 'Contexto', value: context, inline: true },
                        { name: 'Tipo', value: details.errorType, inline: true },
                        { name: 'Timestamp', value: details.timestamp, inline: true },
                        { name: 'Mensagem', value: errorMessage },
                        { name: 'Stack', value: `\`\`\`\n${errorStack.substring(0, 1000)}\n\`\`\`` }
                    ]
                );
            } catch (discordError) {
                console.error('Erro ao enviar log para o Discord:', discordError);
            }
            
            // Salvar em arquivo local sempre, como fallback
            await this.saveToFile('ERROR', details);
            
        } catch (loggerError) {
            // Caso ocorra algum erro no próprio logger
            console.error('❌ Erro crítico no sistema de logging:', loggerError);
        }
    }
}

// Configuração dos formatos
const formats = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Configuração dos transportes
const transports = [];

// Transporte para console
if (config.logging.transports.includes('console')) {
    transports.push(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    );
}

// Transporte para arquivo
if (config.logging.transports.includes('file')) {
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '..', config.logging.filename),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    );
}

// Criar logger do Winston
const winstonLogger = winston.createLogger({
    level: config.logging.level,
    format: formats,
    transports
});

// Funções auxiliares
const log = {
    info: (message, meta = {}) => {
        winstonLogger.info(message, meta);
    },
    error: (message, meta = {}) => {
        winstonLogger.error(message, meta);
    },
    warn: (message, meta = {}) => {
        winstonLogger.warn(message, meta);
    },
    debug: (message, meta = {}) => {
        winstonLogger.debug(message, meta);
    },
    http: (message, meta = {}) => {
        winstonLogger.http(message, meta);
    }
};

// Middleware para logging de requisições HTTP
const httpLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        winstonLogger.http(`${req.method} ${req.originalUrl}`, {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    });

    next();
};

// Exportar a classe Logger
module.exports = {
    Logger,
    winston: winstonLogger,
    log,
    httpLogger
};
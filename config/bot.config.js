const env = require('../modules/env');

module.exports = {
    // Configurações do bot
    token: env.TOKEN,
    clientId: env.CLIENT_ID,
    guildId: env.GUILD_ID,

    // Configurações de intents
    intents: [
        'Guilds',
        'GuildMessages',
        'MessageContent',
        'GuildMembers'
    ],

    // Configurações de comandos
    commands: {
        prefix: '!',
        cooldown: 3, // segundos
        deleteAfter: true
    },

    // Configurações de canais
    channels: {
        whitelist: env.LOG_WHITELIST,
        oraculo: env.LOG_ORACULO,
        admin: env.LOG_ADMIN,
        chat: env.LOG_CHAT,
        filtro: env.LOG_FILTRO,
        punicoes: env.LOG_PUNICOES
    },

    // Configurações de roles
    roles: {
        admin: env.ROLE_ADMIN,
        mod: env.ROLE_MOD,
        member: env.ROLE_MEMBER
    },

    // Configurações de permissões
    permissions: {
        admin: [
            'ADMINISTRATOR',
            'MANAGE_GUILD',
            'MANAGE_ROLES',
            'MANAGE_CHANNELS',
            'MANAGE_MESSAGES',
            'KICK_MEMBERS',
            'BAN_MEMBERS'
        ],
        mod: [
            'MANAGE_MESSAGES',
            'KICK_MEMBERS',
            'BAN_MEMBERS'
        ]
    },

    // Configurações de cooldown
    cooldowns: {
        whitelist: 24 * 60 * 60 * 1000, // 24 horas
        chat: 5 * 60 * 1000, // 5 minutos
        filtro: 1 * 60 * 1000 // 1 minuto
    },

    // Configurações de mensagens
    messages: {
        welcome: 'Bem-vindo(a) ao servidor!',
        goodbye: 'Até mais!',
        error: 'Ocorreu um erro. Tente novamente mais tarde.',
        success: 'Operação realizada com sucesso!',
        denied: 'Você não tem permissão para usar este comando.',
        cooldown: 'Aguarde {time} segundos antes de usar este comando novamente.'
    },

    // Configurações de embeds
    embeds: {
        colors: {
            success: 0x10b981,
            error: 0xef4444,
            warning: 0xf59e0b,
            info: 0x3b82f6
        },
        footer: {
            text: 'MTN Bot'
        }
    },

    // Configurações de filtros
    filters: {
        enabled: true,
        words: [
            'palavra1',
            'palavra2',
            'palavra3'
        ],
        punishment: {
            type: 'warn',
            duration: 24 * 60 * 60 * 1000 // 24 horas
        }
    },

    // Configurações de backup
    backup: {
        enabled: true,
        interval: 24 * 60 * 60 * 1000, // 24 horas
        path: 'backups'
    }
}; 
module.exports = {
    // Configurações do servidor
    server: {
        // Configurações de porta
        port: {
            // Porta mínima para aleatorização
            min: 3000,
            // Porta máxima para aleatorização
            max: 9999,
            // Tentar usar porta específica (null para aleatória)
            specific: 3000
        },
        // URL base do servidor
        url: process.env.WHITELIST_URL || 'http://56.124.64.115',
        // Usar localhost ou IP da máquina
        useLocalhost: false,
        // Configurações de segurança
        security: {
            // Tempo máximo de sessão em minutos
            sessionTimeout: 60,
            // Número máximo de tentativas de login
            maxLoginAttempts: 5
        }
    },
    
    // Configurações do banco de dados
    database: {
        // Tamanho máximo do cache em memória
        maxCacheSize: 1000,
        // Tempo de expiração dos dados em horas
        dataExpiration: 24
    },
    
    // Configurações de notificação
    notifications: {
        // Habilitar notificações via webhook
        webhookEnabled: true,
        // Tempo de espera para notificações em ms
        webhookTimeout: 5000
    },
    
    // Configurações do servidor
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    
    // Configurações do banco de dados
    db: {
        forms: {},
        userLinks: {}
    },
    
    // Configurações do Discord
    discord: {
        // Canais de log
        logs: {
            oraculo: process.env.LOG_ORACULO,
            filtro: process.env.LOG_FILTRO,
            chat: process.env.LOG_CHAT,
            punicoes: process.env.LOG_PUNICOES
        },
        // Canal de whitelist
        channelId: process.env.LOG_WHITELIST,
        webhookUrl: process.env.DISCORD_WEBHOOK_URL
    },
    
    // Configurações de autenticação
    auth: {
        adminUsername: process.env.ADMIN_USERNAME || 'admin',
        adminPassword: process.env.ADMIN_PASSWORD,
        jwtSecret: process.env.JWT_SECRET,
        tokenExpiration: '24h'
    },
    
    // Configurações do formulário
    form: {
        minAge: 18,
        requiredFields: ['nome', 'idade', 'estado', 'comoConheceu', 'religiao'],
        status: {
            pending: 'pendente',
            approved: 'aprovado',
            rejected: 'rejeitado'
        }
    }
}; 
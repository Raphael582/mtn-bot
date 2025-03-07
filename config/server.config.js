const env = require('../modules/env');

module.exports = {
    // Configurações do servidor
    port: env.PORT || 3000,
    host: env.HOST || 'localhost',

    // Configurações de segurança
    security: {
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization']
        },
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 100 // limite de 100 requisições por IP
        }
    },

    // Configurações de sessão
    session: {
        secret: env.SESSION_SECRET || 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 horas
        }
    },

    // Configurações de logging
    logging: {
        level: env.LOG_LEVEL || 'info',
        format: 'dev',
        transports: ['console', 'file'],
        filename: 'logs/server.log'
    },

    // Configurações de armazenamento
    storage: {
        type: 'json',
        path: 'data'
    },

    // Configurações de cache
    cache: {
        enabled: true,
        ttl: 60 * 60 * 1000, // 1 hora
        maxSize: 1000 // máximo de 1000 itens
    },

    // Configurações de email
    email: {
        enabled: false,
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM
    },

    // Configurações de upload
    upload: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
        path: 'uploads'
    },

    // Configurações de paginação
    pagination: {
        defaultLimit: 10,
        maxLimit: 100
    }
}; 
const path = require('path');
const env = require('../modules/env');

module.exports = {
    // Configurações do servidor
    server: {
        url: env.WHITELIST_URL || `http://${env.HOST || 'localhost'}:${env.PORT || 3000}`,
        port: env.PORT || 3000,
        host: env.HOST || 'localhost'
    },

    // Configurações de armazenamento
    storage: {
        type: 'json',
        path: path.join(__dirname, '..', 'data')
    },

    // Configurações de notificação
    notifications: {
        webhook: {
            url: env.WHITELIST_WEBHOOK_URL,
            enabled: true
        }
    },

    // Configurações de canais do Discord
    discord: {
        channels: {
            whitelist: env.LOG_WHITELIST,
            oraculo: env.LOG_ORACULO,
            admin: env.LOG_ADMIN
        }
    },

    // Configurações de autenticação
    auth: {
        jwt: {
            secret: env.ADMIN_JWT_SECRET,
            expiresIn: '24h'
        },
        admin: {
            username: env.ADMIN_USERNAME,
            password: env.ADMIN_PASSWORD
        }
    },

    // Configurações de validação
    validation: {
        minAge: 16,
        maxAge: 100,
        allowedStates: [
            'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
            'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
            'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
        ]
    }
}; 
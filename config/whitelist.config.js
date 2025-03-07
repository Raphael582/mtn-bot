module.exports = {
    // Configurações do servidor
    server: {
        // Porta padrão do servidor
        port: 3000,
        // URL base do servidor
        url: process.env.WHITELIST_URL || 'http://localhost',
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
    }
}; 
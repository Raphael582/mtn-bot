const path = require('path');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente com caminho absoluto
const envPath = path.resolve(__dirname, '..', '.env');
console.log('\n🔍 Carregando arquivo .env:', envPath);

// Carregar o arquivo .env
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('❌ Erro ao carregar arquivo .env:', result.error);
    throw result.error;
}

// Configurações padrão
const defaultConfig = {
    // Configurações do Bot Discord
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,

    // Configurações da API Gemini
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,

    // Configurações do Servidor de Whitelist
    WHITELIST_URL: process.env.WHITELIST_URL,
    PORT: process.env.PORT || 3000,

    // Autenticação Admin
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,

    // Canais de Log
    LOG_ORACULO: process.env.LOG_ORACULO,
    LOG_FILTRO: process.env.LOG_FILTRO,
    LOG_CHAT: process.env.LOG_CHAT,
    LOG_PUNICOES: process.env.LOG_PUNICOES,
    LOG_WHITELIST: process.env.LOG_WHITELIST,

    // Cargos
    ROLE_ACESS: process.env.ROLE_ACESS,
    WHITELIST_ROLE_ID: process.env.WHITELIST_ROLE_ID,

    // Configurações de Segurança
    NODE_ENV: process.env.NODE_ENV || 'development',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000'
};

// Mesclar configurações do .env com as padrão
const config = { ...defaultConfig, ...process.env };

// Validar configurações obrigatórias
const requiredVars = [
    'TOKEN',
    'CLIENT_ID',
    'GUILD_ID',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'JWT_SECRET',
    'ADMIN_JWT_SECRET',
    'LOG_ORACULO',
    'LOG_FILTRO',
    'LOG_CHAT',
    'LOG_PUNICOES',
    'LOG_WHITELIST'
];

for (const varName of requiredVars) {
    if (!config[varName]) {
        console.error(`❌ Variável ${varName} não está configurada`);
        throw new Error(`Variável ${varName} não está configurada`);
    }
}

console.log('✅ Arquivo .env carregado com sucesso');
console.log('\n📋 Configurações carregadas:');
console.log('- TOKEN:', config.TOKEN ? 'Configurado' : 'Não configurado');
console.log('- CLIENT_ID:', config.CLIENT_ID);
console.log('- GUILD_ID:', config.GUILD_ID);
console.log('- ADMIN_USERNAME:', config.ADMIN_USERNAME);
console.log('- ADMIN_PASSWORD:', config.ADMIN_PASSWORD ? 'Configurada' : 'Não configurada');
console.log('- JWT_SECRET:', config.JWT_SECRET ? 'Configurado' : 'Não configurado');
console.log('- ADMIN_JWT_SECRET:', config.ADMIN_JWT_SECRET ? 'Configurado' : 'Não configurado');
console.log('- LOG_ORACULO:', config.LOG_ORACULO);
console.log('- LOG_FILTRO:', config.LOG_FILTRO);
console.log('- LOG_CHAT:', config.LOG_CHAT);
console.log('- LOG_PUNICOES:', config.LOG_PUNICOES);
console.log('- LOG_WHITELIST:', config.LOG_WHITELIST);

module.exports = config; 
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Carregar variáveis de ambiente com caminho absoluto
const envPath = path.resolve(__dirname, '..', '.env');
console.log('\n🔍 Carregando arquivo .env:', envPath);

// Verificar se o arquivo existe
if (!fs.existsSync(envPath)) {
    console.error('❌ Arquivo .env não encontrado em:', envPath);
    throw new Error('Arquivo .env não encontrado');
}

// Ler o conteúdo do arquivo
const envContent = fs.readFileSync(envPath, 'utf8');
console.log('\n📄 Conteúdo do arquivo .env:');
console.log(envContent);

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
    WHITELIST_URL: process.env.WHITELIST_URL || 'http://localhost:3000',
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || 'localhost',

    // Autenticação Admin
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,

    // Canais de Log
    LOG_ORACULO: process.env.LOG_ORACULO,
    LOG_FILTRO: process.env.LOG_FILTRO,
    LOG_CHAT: process.env.LOG_CHAT,
    LOG_PUNICOES: process.env.LOG_PUNICOES,
    LOG_WHITELIST: process.env.LOG_WHITELIST,
    LOG_ADMIN: process.env.LOG_ADMIN,

    // Webhook
    WHITELIST_WEBHOOK_URL: process.env.WHITELIST_WEBHOOK_URL,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,

    // Cargos
    WHITELIST_ROLE_ID: process.env.WHITELIST_ROLE_ID
};

// Validar variáveis obrigatórias
const requiredVars = [
    'TOKEN',
    'CLIENT_ID',
    'GUILD_ID',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'JWT_SECRET',
    'ADMIN_JWT_SECRET'
];

const missingVars = requiredVars.filter(varName => !defaultConfig[varName]);

if (missingVars.length > 0) {
    console.error('\n❌ Variáveis de ambiente obrigatórias não configuradas:');
    missingVars.forEach(varName => {
        console.error(`- ${varName}`);
    });
    throw new Error('Variáveis de ambiente obrigatórias não configuradas');
}

// Exportar configurações
module.exports = defaultConfig; 
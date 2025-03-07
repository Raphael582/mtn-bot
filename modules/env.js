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

console.log('✅ Arquivo .env carregado com sucesso');

// Exportar as variáveis de ambiente
module.exports = process.env; 
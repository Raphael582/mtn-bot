require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Função para verificar se uma variável de ambiente é obrigatória
function requireEnv(name, defaultValue = null) {
  const value = process.env[name] || defaultValue;
  
  if (value === null) {
    console.error(`❌ Variável de ambiente obrigatória não definida: ${name}`);
    console.error('Por favor, defina esta variável no arquivo .env');
    process.exit(1);
  }
  
  return value;
}

// Valores padrão para desenvolvimento
const defaults = {
  NODE_ENV: 'development',
  PORT: '3000',
  HOST: '0.0.0.0',
  SESSION_SECRET: 'metania-whitelist-secret',
  LOG_LEVEL: 'info',
  WHITELIST_URL: 'http://localhost:3000/whitelist',
  // As variáveis abaixo não devem ter valores padrão em produção
  JWT_SECRET: process.env.NODE_ENV !== 'production' ? 'dev-jwt-secret' : null,
  ADMIN_USERNAME: process.env.NODE_ENV !== 'production' ? 'admin' : null,
  ADMIN_PASSWORD: process.env.NODE_ENV !== 'production' ? 'admin123' : null,
};

// Criação do objeto de ambiente
const env = {
  // Configurações do servidor
  NODE_ENV: process.env.NODE_ENV || defaults.NODE_ENV,
  PORT: process.env.PORT || defaults.PORT,
  HOST: process.env.HOST || defaults.HOST,
  
  // Segurança
  JWT_SECRET: requireEnv('JWT_SECRET', defaults.JWT_SECRET),
  SESSION_SECRET: process.env.SESSION_SECRET || defaults.SESSION_SECRET,
  
  // Administração
  ADMIN_USERNAME: requireEnv('ADMIN_USERNAME', defaults.ADMIN_USERNAME),
  ADMIN_PASSWORD: requireEnv('ADMIN_PASSWORD', defaults.ADMIN_PASSWORD),
  
  // Discord
  WHITELIST_WEBHOOK_URL: process.env.WHITELIST_WEBHOOK_URL,
  BOT_TOKEN: process.env.BOT_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  WHITELIST_ROLE_ID: process.env.WHITELIST_ROLE_ID,
  
  // URLs
  WHITELIST_URL: process.env.WHITELIST_URL || defaults.WHITELIST_URL,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || defaults.LOG_LEVEL,
  LOG_DISCORD_CHANNEL: process.env.LOG_DISCORD_CHANNEL,
  ERROR_DISCORD_CHANNEL: process.env.ERROR_DISCORD_CHANNEL,
  
  // Diretórios
  ROOT_DIR: path.resolve(__dirname),
  
  // Funções auxiliares
  isDevelopment: function() {
    return this.NODE_ENV === 'development';
  },
  
  isProduction: function() {
    return this.NODE_ENV === 'production';
  },
  
  // Criação do .env.example se não existir
  createEnvExample: function() {
    const envPath = path.join(__dirname, '.env');
    const examplePath = path.join(__dirname, '.env.example');
    
    if (!fs.existsSync(examplePath) && fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const exampleContent = envContent
          .split('\n')
          .map(line => {
            // Comentar linhas vazias ou que já são comentários
            if (!line.trim() || line.startsWith('#')) {
              return line;
            }
            
            // Para as outras linhas, remover o valor e adicionar comentário explicativo
            const parts = line.split('=');
            if (parts.length > 1) {
              return `${parts[0]}=` // Mantém apenas a chave
            }
            return line;
          })
          .join('\n');
        
        fs.writeFileSync(examplePath, exampleContent);
        console.log('✅ Arquivo .env.example criado com sucesso');
      } catch (error) {
        console.error('❌ Erro ao criar .env.example:', error);
      }
    }
  }
};

// Aplicar a função de criação do .env.example em desenvolvimento
if (env.isDevelopment()) {
  env.createEnvExample();
}

// Exibir configurações
if (env.isDevelopment()) {
  console.log('📋 Variáveis de ambiente carregadas:');
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'function') {
      const displayValue = key.includes('SECRET') || key.includes('TOKEN') || key.includes('PASSWORD')
        ? '********'
        : value;
      console.log(`  ${key}: ${displayValue}`);
    }
  }
}

module.exports = env; 
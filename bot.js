const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('./modules/env');

// Importar o servidor de whitelist
const WhitelistServer = require('./modules/whitelist-server');
let whitelistServer = null;

// Configuração do cliente Discord com intents necessários
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;

// Verificação de variáveis obrigatórias
if (!clientId || !token) {
    console.error('❌ Variáveis de ambiente CLIENT_ID e TOKEN são obrigatórias');
    process.exit(1);
}

// Coleção para comandos
client.commands = new Collection();

// Carregar logger
const { Logger } = require('./modules/logger');
const logger = new Logger(client);

// Função para inicializar o servidor de whitelist
async function initWhitelistServer() {
    try {
        if (!whitelistServer) {
            console.log('🌐 Iniciando servidor de whitelist...');
            whitelistServer = new WhitelistServer(client);
            await whitelistServer.start();
            console.log(`✅ Servidor de whitelist iniciado na porta ${process.env.WHITELIST_PORT || '3000'}`);
            
            // Disponibilizar globalmente
            global.whitelistServer = whitelistServer;
            return whitelistServer;
        } else {
            return whitelistServer;
        }
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor de whitelist:', error);
        await logger.logError(error, 'whitelist-server-init');
        return null;
    }
}

// Garantir diretórios necessários
function ensureDirectories() {
    const dirs = [
        path.join(__dirname, 'database'),
        path.join(__dirname, 'logs'),
        path.join(__dirname, 'whitelist-frontend')
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Diretório ${dir} criado`);
        }
    });
}

// Carregando comandos
async function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
        console.warn('⚠️ Diretório de comandos não encontrado');
        return;
    }
    
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    console.log(`📦 Carregando ${commandFiles.length} comandos...`);

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            // Carregar comando
            const command = require(filePath);
            const commandModule = command.default || command;
            
            // Verificar estrutura do comando
            if (commandModule.data && commandModule.execute) {
                client.commands.set(commandModule.data.name, commandModule);
                console.log(`✅ Comando carregado: ${commandModule.data.name}`);
            } else {
                console.warn(`⚠️ Comando ${file} não tem a estrutura esperada (data + execute)`);
            }
        } catch (error) {
            console.error(`❌ Erro ao carregar comando ${file}:`, error);
            await logger.logError(error, `command-load-${file}`);
        }
    }
}

// Registrando comandos slash
async function registerCommands() {
    try {
        const commands = [];
        
        // Coletar comandos para registro
        client.commands.forEach(command => {
            if (command.data) {
                // Usar toJSON se disponível, senão usar diretamente
                const commandData = typeof command.data.toJSON === 'function' 
                    ? command.data.toJSON() 
                    : command.data;
                commands.push(commandData);
            }
        });

        console.log(`📋 Registrando ${commands.length} comandos...`);
        
        if (commands.length > 0) {
            const rest = new REST({ version: '10' }).setToken(token);
            
            try {
                await rest.put(Routes.applicationCommands(clientId), { body: commands });
                console.log('✅ Comandos registrados com sucesso!');
            } catch (error) {
                console.error(`❌ Erro ao registrar comandos:`, error);
                await logger.logError(error, 'command-registration');
            }
        } else {
            console.warn('⚠️ Nenhum comando para registrar!');
        }
    } catch (error) {
        console.error('❌ Erro no registro de comandos:', error);
        await logger.logError(error, 'commands-registration');
    }
}

// Evento quando o bot estiver pronto
client.once('ready', async () => {
    try {
        console.log(`\n🤖 Bot está online como ${client.user.tag}`);
        console.log('📋 Informações do bot:');
        console.log(`- ID: ${client.user.id}`);
        console.log(`- Servidores: ${client.guilds.cache.size}`);
        
        // Garantir diretórios
        ensureDirectories();
        
        // Carregar comandos
        await loadCommands();
        
        // Registrar comandos
        await registerCommands();
        
        // Iniciar servidor de whitelist
        await initWhitelistServer();
        
        // Registrar que o bot está pronto
        console.log('\n✅ Bot inicializado e pronto!');
    } catch (error) {
        console.error('❌ Erro durante inicialização:', error);
        await logger.logError(error, 'bot-initialization');
    }
});

// Evento de mensagem (para o filtro de chat)
client.on('messageCreate', async (message) => {
    try {
        // Ignorar mensagens do próprio bot e DMs
        if (message.author.bot || !message.guild) return;
        
        // Módulo de filtro de chat importado dinamicamente para reduzir carga na inicialização
        const ChatFilter = require('./modules/chat-filter');
        if (ChatFilter.handleMessage) {
            await ChatFilter.handleMessage(message, client);
        }
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        await logger.logError(error, 'message-processing');
    }
});

// Evento de interação
client.on('interactionCreate', async interaction => {
    try {
        // Ignorar interações que não são comandos
        if (!interaction.isCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Executar comando
        console.log(`🔄 Executando comando: ${interaction.commandName} por ${interaction.user.tag}`);
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ Erro executando o comando ${interaction.commandName}:`, error);
        
        // Registrar erro
        await logger.logError(error, `command-execution-${interaction.commandName}`);

        // Responder ao usuário
        try {
            const errorMessage = '❌ Ocorreu um erro ao executar este comando.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (replyError) {
            console.error('❌ Erro ao enviar mensagem de erro:', replyError);
        }
    }
});

// Tratamento de erros não capturados
process.on('unhandledRejection', async error => {
    console.error('❌ Unhandled promise rejection:', error);
    await logger.logError(error, 'unhandled-rejection');
});

process.on('uncaughtException', async error => {
    console.error('❌ Uncaught exception:', error);
    await logger.logError(error, 'uncaught-exception');
    
    // Em caso de erros críticos, tentar um encerramento limpo
    try {
        await gracefulShutdown();
    } finally {
        process.exit(1);
    }
});

// Adicionar tratamento para encerrar o servidor web ao desconectar
async function gracefulShutdown() {
    console.log('🛑 Encerrando aplicação...');
    
    try {
        if (whitelistServer) {
            console.log('🌐 Parando servidor de whitelist...');
            await whitelistServer.stop();
            console.log('✅ Servidor de whitelist parado com sucesso');
        }
        
        // Desconectar cliente Discord
        if (client) {
            console.log('🤖 Desconectando bot Discord...');
            await client.destroy();
            console.log('✅ Bot Discord desconectado com sucesso');
        }
        
        console.log('👋 Aplicação encerrada com sucesso');
    } catch (error) {
        console.error('❌ Erro durante encerramento:', error);
    }
}

// Capturar sinais de encerramento
['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, async () => {
        console.log(`\n${signal} recebido. Iniciando encerramento limpo...`);
        await gracefulShutdown();
        process.exit(0);
    });
});

// Iniciar a conexão com o Discord
console.log('🔌 Conectando ao Discord...');
client.login(token)
    .catch(async error => {
        console.error('❌ Erro ao conectar ao Discord:', error);
        await logger.logError(error, 'discord-login');
        process.exit(1);
    });
const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Importar o servidor de whitelist
const WhitelistServer = require('./modules/whitelist-server');
let whitelistServer = null;

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

// Coleção para comandos
client.commands = new Collection();

// Módulo de filtro de chat
let chatFilter;

// Carregar logger
const logger = require('./modules/logger');

// Função para inicializar o servidor de whitelist
async function initWhitelistServer() {
    try {
        if (!whitelistServer) {
            console.log('🌐 Iniciando servidor de whitelist...');
            whitelistServer = new WhitelistServer(client);
            await whitelistServer.start();
            console.log(`✅ Servidor de whitelist iniciado na porta ${process.env.WHITELIST_PORT}`);
            
            // Criar diretório de frontend se não existir
            const frontendPath = path.join(__dirname, 'whitelist-frontend');
            if (!fs.existsSync(frontendPath)) {
                fs.mkdirSync(frontendPath, { recursive: true });
                console.log('📁 Diretório de frontend criado');
                
                // O servidor já cria os arquivos básicos ao iniciar
                console.log('✅ Arquivos de frontend básicos criados pelo servidor');
            }
            
            // Disponibilizar globalmente
            global.whitelistServer = whitelistServer;
            return whitelistServer;
        } else {
            return whitelistServer;
        }
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor de whitelist:', error);
        return null;
    }
}

// Carregando comandos
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            // Tentar carregar o módulo de diferentes formas
            let command;
            try {
                command = require(filePath);
            } catch (importError) {
                console.error(`❌ Erro ao importar ${file}:`, importError);
                continue;
            }

            // Normalizar o comando
            const commandModule = command.default || command;
            
            // Se for o módulo de filtro de chat, armazená-lo separadamente
            if (file === 'chatfilter.js') {
                chatFilter = commandModule;
                if (commandModule.commands) {
                    client.commands.set(commandModule.commands.data.name, commandModule.commands);
                    console.log(`✅ Comando de filtro carregado: ${commandModule.commands.data.name}`);
                }
                continue;
            }
            
            // Verificar diferentes formatos de comando
            if (commandModule.data && commandModule.execute) {
                // Slash command com data e execute
                client.commands.set(commandModule.data.name, commandModule);
                console.log(`✅ Comando slash carregado: ${commandModule.data.name}`);
            } 
            else if (commandModule.execute) {
                // Comando legado
                const commandName = file.replace('.js', '');
                client.commands.set(commandName, commandModule);
                console.log(`✅ Comando legado carregado: ${commandName}`);
            } 
            else {
                console.warn(`⚠️ Comando em ${filePath} não tem propriedades necessárias.`);
            }
        } catch (error) {
            console.error(`❌ Erro ao carregar comando ${file}:`, error);
        }
    }
}

// Registrando comandos slash
async function registerCommands() {
    const commands = [];
    
    // Coletar comandos para registro
    for (const command of client.commands.values()) {
        if (command.data) {
            // Usar toJSON se disponível, senão usar diretamente
            const commandData = typeof command.data.toJSON === 'function' 
                ? command.data.toJSON() 
                : command.data;
            commands.push(commandData);
        }
    }

    console.log('📤 Registrando comandos...');
    console.log(`📋 Total de comandos: ${commands.length}`);
    
    if (commands.length > 0) {
        const rest = new REST({ version: '10' }).setToken(token);
        
        try {
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log('✅ Comandos registrados!');
        } catch (error) {
            console.error(`❌ Erro ao registrar comandos: ${error}`);
        }
    } else {
        console.warn('⚠️ Nenhum comando para registrar!');
    }
}

// Evento quando o bot estiver pronto
client.once('ready', async () => {
    console.log(`✅ Bot está online como ${client.user.tag}`);
    
    // Registrar comandos
    await registerCommands();
    
    // Verificar diretório de banco de dados
    const dbPath = path.join(__dirname, 'database');
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log('📁 Diretório de banco de dados criado');
    }
    
    // Iniciar servidor de whitelist
    await initWhitelistServer();
});

// Evento de mensagem (para o filtro de chat)
client.on('messageCreate', async (message) => {
    // Verificar se o módulo de filtro está disponível
    if (chatFilter && chatFilter.handleMessage) {
        try {
            await chatFilter.handleMessage(message, client);
        } catch (error) {
            console.error('❌ Erro ao processar filtro de chat:', error);
            // Registrar o erro no sistema de logs
            try {
                await logger.logError(message.guild, 'filtro-chat', error, {
                    userId: message.author.id,
                    messageId: message.id,
                    channelId: message.channel.id,
                    content: message.content
                });
            } catch (logError) {
                console.error('❌ Erro ao registrar erro de filtro:', logError);
            }
        }
    }
});

// Evento de interação
client.on('interactionCreate', async (interaction) => {
    try {
        // Comandos slash
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`❌ Comando ${interaction.commandName} não encontrado.`);
                await interaction.reply({ 
                    content: 'Este comando não está configurado corretamente.', 
                    ephemeral: true 
                });
                return;
            }

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`❌ Erro executando o comando ${interaction.commandName}:`, error);
                
                // Registrar o erro no sistema de logs
                try {
                    await logger.logError(interaction.guild, `comando-${interaction.commandName}`, error, {
                        userId: interaction.user.id,
                        channelId: interaction.channelId
                    });
                } catch (logError) {
                    console.error('❌ Erro ao registrar erro de comando:', logError);
                }
                
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: 'Ocorreu um erro ao executar este comando.', 
                        ephemeral: true 
                    }).catch(console.error);
                } else {
                    await interaction.editReply({
                        content: 'Ocorreu um erro ao executar este comando.'
                    }).catch(console.error);
                }
            }
        }
        
        // Botões
        else if (interaction.isButton()) {
            const customId = interaction.customId;
            
            if (customId === 'start_whitelist' || customId === 'open_whitelist_modal') {
                const whitelistCommand = client.commands.get('whitelist');
                if (whitelistCommand) {
                    await whitelistCommand.execute(interaction, client);
                }
            } 
            else if (customId.startsWith('approve_whitelist_') || 
                    customId.startsWith('reject_whitelist_')) {
                const whitelistCommand = client.commands.get('whitelist');
                if (whitelistCommand) {
                    await whitelistCommand.execute(interaction, client);
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro ao processar interação:', error);
    }
});

// Tratamento de erros não capturados
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Adicionar tratamento para encerrar o servidor web ao desconectar
process.on('SIGINT', async () => {
    console.log('🛑 Encerrando aplicação...');
    
    if (whitelistServer) {
        console.log('🌐 Parando servidor de whitelist...');
        await whitelistServer.stop();
    }
    
    console.log('👋 Bot desconectado.');
    process.exit(0);
});

client.login(token);
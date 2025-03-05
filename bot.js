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
        console.log('🔍 Verificando se o servidor whitelist já existe...');
        if (!whitelistServer) {
            console.log('🌐 Iniciando servidor de whitelist...');
            
            console.log('📂 Verificando módulo WhitelistServer...');
            const WhitelistServerPath = path.join(__dirname, 'modules', 'whitelist-server.js');
            console.log(`📄 Caminho do módulo: ${WhitelistServerPath}`);
            console.log(`📄 Módulo existe: ${fs.existsSync(WhitelistServerPath)}`);
            
            try {
                console.log('🔄 Importando módulo WhitelistServer...');
                const WhitelistServerModule = require('./modules/whitelist-server');
                console.log('✅ Módulo importado com sucesso');
                
                console.log('🏗️ Criando instância do servidor...');
                whitelistServer = new WhitelistServerModule(client);
                console.log('✅ Instância criada com sucesso');
                
                console.log('🔧 Verificando opções do servidor...');
                console.log(JSON.stringify(whitelistServer.options, null, 2));
                
                console.log('🚀 Iniciando servidor...');
                await whitelistServer.start();
                console.log(`✅ Servidor de whitelist iniciado na porta ${whitelistServer.options.port}`);
                
                // Disponibilizar globalmente
                global.whitelistServer = whitelistServer;
                return whitelistServer;
            } catch (initError) {
                console.error('❌ Erro durante inicialização:', initError);
                console.error(initError.stack);
                return null;
            }
        } else {
            console.log('⚠️ Servidor whitelist já está iniciado');
            return whitelistServer;
        }
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor whitelist:', error);
        console.error(error.stack);
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
                if (whitelistCommand && whitelistCommand.handleButton) {
                    await whitelistCommand.handleButton(interaction, client);
                }
            } 
            else if (customId.startsWith('approve_whitelist_') || 
                    customId.startsWith('reject_whitelist_')) {
                // Usar o manipulador de aprovação/rejeição do whitelist
                const whitelistCommand = client.commands.get('whitelist');
                if (whitelistCommand && whitelistCommand.handleApprovalButtons) {
                    await whitelistCommand.handleApprovalButtons(interaction, client);
                } else if (client.commands.get('wlnew') && client.commands.get('wlnew').handleButtonApproval) {
                    // Fallback para o comando wlnew se whitelist não tiver o manipulador
                    await client.commands.get('wlnew').handleButtonApproval(interaction, client);
                } else {
                    console.error('❌ Manipuladores de aprovação não encontrados');
                    await interaction.reply({ 
                        content: 'Função de aprovação/rejeição não configurada.', 
                        ephemeral: true 
                    });
                }
            }
        }
        
        // Modais
        else if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            
            if (customId === 'whitelist_modal') {
                const whitelistCommand = client.commands.get('whitelist');
                if (whitelistCommand && whitelistCommand.handleModal) {
                    await whitelistCommand.handleModal(interaction, client);
                }
            } else if (customId === 'whitelist_modal_new') {
                const wlnewCommand = client.commands.get('wlnew');
                if (wlnewCommand && wlnewCommand.handleModal) {
                    await wlnewCommand.handleModal(interaction, client);
                } else {
                    console.error('❌ Método handleModal não encontrado para wlnew');
                    await interaction.reply({ 
                        content: 'Erro ao processar o formulário de whitelist.', 
                        ephemeral: true 
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro geral na interação:', error);
        
        // Tentar registrar o erro
        try {
            if (interaction.guild) {
                await logger.logError(interaction.guild, 'interacao', error, {
                    userId: interaction.user?.id,
                    type: interaction.type,
                    commandName: interaction.commandName
                });
            }
        } catch (logError) {
            console.error('❌ Erro ao registrar erro de interação:', logError);
        }
        
        // Responder ao usuário
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Ocorreu um erro ao processar esta interação.', 
                    ephemeral: true 
                });
            } else {
                await interaction.editReply({ 
                    content: 'Ocorreu um erro ao processar esta interação.' 
                });
            }
        } catch (replyError) {
            console.error('❌ Erro ao tentar informar erro ao usuário:', replyError);
        }
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

// Inicie o servidor whitelist alternativo
// Verifique se o arquivo new-whitelist-server.js existe antes de tentar carregar
const newWhitelistServerPath = path.join(__dirname, 'new-whitelist-server.js');
if (fs.existsSync(newWhitelistServerPath)) {
    try {
        console.log('🔄 Carregando servidor whitelist alternativo...');
        require('./new-whitelist-server');
        console.log('✅ Servidor whitelist alternativo iniciado');
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor whitelist alternativo:', error);
        console.error(error.stack);
    }
} else {
    console.log('⚠️ Arquivo new-whitelist-server.js não encontrado');
    
    // Criar um servidor express simples como fallback
    try {
        console.log('🔄 Criando servidor Express simples como fallback...');
        const express = require('express');
        const app = express();
        const PORT = 3000;
        
        app.get('/', (req, res) => {
            res.send('<h1>Servidor Whitelist Metânia</h1><p>Versão simplificada em manutenção.</p>');
        });
        
        app.listen(PORT, () => {
            console.log(`✅ Servidor fallback iniciado na porta ${PORT}`);
        });
    } catch (fallbackError) {
        console.error('❌ Erro ao criar servidor fallback:', fallbackError);
    }
}

client.login(token);
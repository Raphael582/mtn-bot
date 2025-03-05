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
            console.log(`✅ Servidor de whitelist iniciado na porta ${whitelistServer.options.port}`);
            
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
            // Novos botões específicos para o servidor web
            else if (customId.startsWith('wl_approve_') || customId.startsWith('wl_reject_')) {
                const formId = customId.split('_')[2];
                const action = customId.startsWith('wl_approve_') ? 'aprovado' : 'rejeitado';
                
                if (!whitelistServer) {
                    await initWhitelistServer();
                }
                
                if (whitelistServer) {
                    try {
                        // Buscar formulário
                        const form = whitelistServer.db.forms[formId];
                        
                        if (!form) {
                            await interaction.reply({
                                content: '❌ Formulário não encontrado ou já processado.',
                                ephemeral: true
                            });
                            return;
                        }
                        
                        // Confirmar ação
                        await interaction.reply({
                            content: `⚠️ Tem certeza que deseja ${action === 'aprovado' ? 'aprovar' : 'rejeitar'} a whitelist de **${form.username}**?`,
                            ephemeral: true,
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            style: action === 'aprovado' ? 3 : 4,
                                            label: 'Confirmar',
                                            custom_id: `confirm_${action}_${formId}`
                                        },
                                        {
                                            type: 2,
                                            style: 2,
                                            label: 'Cancelar',
                                            custom_id: 'cancel_action'
                                        }
                                    ]
                                }
                            ]
                        });
                    } catch (error) {
                        console.error('❌ Erro ao processar botão de whitelist:', error);
                        await interaction.reply({
                            content: 'Ocorreu um erro ao processar esta ação.',
                            ephemeral: true
                        });
                    }
                } else {
                    await interaction.reply({
                        content: '❌ Servidor de whitelist não está disponível.',
                        ephemeral: true
                    });
                }
            }
            // Confirmação de ações de whitelist
            else if (customId.startsWith('confirm_aprovado_') || customId.startsWith('confirm_rejeitado_')) {
                const [_, action, formId] = customId.split('_');
                
                await interaction.deferUpdate();
                
                if (!whitelistServer) {
                    await initWhitelistServer();
                }
                
                if (whitelistServer) {
                    try {
                        // Buscar formulário
                        const form = whitelistServer.db.forms[formId];
                        
                        if (!form) {
                            await interaction.followUp({
                                content: '❌ Formulário não encontrado ou já processado.',
                                ephemeral: true
                            });
                            return;
                        }
                        
                        // Atualizar formulário
                        form.status = action;
                        form.reviewedBy = interaction.user.tag;
                        form.reviewedAt = new Date().toISOString();
                        
                        // Salvar
                        whitelistServer.saveForms();
                        
                        // Notificar usuário se tiver Discord ID
                        if (form.discordId) {
                            await whitelistServer.notifyUser(form, action, '');
                        }
                        
                        // Atualizar resposta
                        await interaction.editReply({
                            content: `✅ Whitelist de **${form.username}** foi ${action} com sucesso!`,
                            components: []
                        });
                        
                    } catch (error) {
                        console.error('❌ Erro ao processar confirmação:', error);
                        await interaction.followUp({
                            content: 'Ocorreu um erro ao processar esta ação.',
                            ephemeral: true
                        });
                    }
                } else {
                    await interaction.followUp({
                        content: '❌ Servidor de whitelist não está disponível.',
                        ephemeral: true
                    });
                }
            }
            else if (customId === 'cancel_action') {
                await interaction.update({
                    content: '❌ Ação cancelada.',
                    components: []
                });
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

client.login(token);
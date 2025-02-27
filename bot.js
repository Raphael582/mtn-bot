const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

// Carregando comandos
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            
            // Se for o módulo de filtro de chat, armazená-lo separadamente
            if (file === 'chatfilter.js') {
                chatFilter = command;
                if (command.commands) {
                    client.commands.set(command.commands.data.name, command.commands);
                    console.log(`✅ Comando de filtro carregado: ${command.commands.data.name}`);
                }
                continue;
            }
            
            // Se o comando tiver data e execute (SlashCommandBuilder)
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`✅ Comando slash carregado: ${command.data.name}`);
            } 
            // Para comandos legados
            else if ('execute' in command) {
                const commandName = file.replace('.js', '');
                client.commands.set(commandName, command);
                console.log(`✅ Comando legado carregado: ${commandName}`);
            } 
            else {
                console.log(`⚠️ Comando em ${filePath} não tem propriedades necessárias.`);
            }
        } catch (error) {
            console.error(`❌ Erro ao carregar comando ${file}:`, error);
        }
    }
}

// Carregando módulos adicionais
const modulesPath = path.join(__dirname, 'modules');
if (fs.existsSync(modulesPath)) {
    console.log('📂 Carregando módulos...');
    // Podemos adicionar aqui lógica para carregar outros módulos se necessário
}

// Registrando comandos slash
async function registerCommands() {
    const commands = [];
    
    // Comandos slash (novos com data)
    for (const command of client.commands.values()) {
        if (command.data) {
            // Verificar se data.toJSON é uma função
            if (typeof command.data.toJSON === 'function') {
                commands.push(command.data.toJSON());
            } 
            // Se data já for um objeto, usá-lo diretamente
            else if (typeof command.data === 'object') {
                commands.push(command.data);
            }
            else {
                console.warn(`⚠️ Comando ${command.data?.name || 'desconhecido'} não tem método toJSON() ou não é um objeto válido`);
            }
        }
    }
    
    // Adicionar comando whitelist legado se não existir no formato slash
    if (!client.commands.has('whitelist')) {
        commands.push({
            name: 'whitelist',
            description: 'Inicia o processo de whitelist para o usuário.',
        });
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
client.once('ready', () => {
    console.log(`✅ Bot está online como ${client.user.tag}`);
    registerCommands();
    
    // Verificar diretório de banco de dados
    const dbPath = path.join(__dirname, 'database');
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log('📁 Diretório de banco de dados criado');
    }
});

// Evento de mensagem (para o filtro de chat)
client.on('messageCreate', async (message) => {
    // Verificar se o módulo de filtro está disponível
    if (chatFilter && chatFilter.handleMessage) {
        try {
            await chatFilter.handleMessage(message, client);
        } catch (error) {
            console.error('❌ Erro ao processar filtro de chat:', error);
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
                // Verifica se é o whitelist legado
                if (interaction.commandName === 'whitelist') {
                    const whitelistCommand = client.commands.get('whitelist');
                    if (whitelistCommand) {
                        await whitelistCommand.execute(interaction, client);
                    } else {
                        console.error(`❌ Comando 'whitelist' não encontrado.`);
                        await interaction.reply({ content: 'Comando não configurado.', ephemeral: true });
                    }
                } else {
                    console.error(`❌ Comando ${interaction.commandName} não encontrado.`);
                    await interaction.reply({ content: 'Comando não encontrado.', ephemeral: true });
                }
                return;
            }

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`❌ Erro executando o comando ${interaction.commandName}:`, error);
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
            
            if (customId === 'start_whitelist') {
                const whitelistCommand = client.commands.get('whitelist');
                if (whitelistCommand) {
                    await whitelistCommand.handleButton(interaction, client);
                }
            } 
            else if (customId.startsWith('approve_whitelist') || customId.startsWith('reject_whitelist')) {
                // Tentativa com managewhitelist primeiro, fallback para whitelist
                const manageWhitelist = client.commands.get('managewhitelist');
                if (manageWhitelist && manageWhitelist.handleButtonApproval) {
                    await manageWhitelist.handleButtonApproval(interaction, client);
                } else {
                    const whitelistCommand = client.commands.get('whitelist');
                    if (whitelistCommand && whitelistCommand.handleButtonApproval) {
                        await whitelistCommand.handleButtonApproval(interaction, client);
                    } else {
                        console.error('❌ Método handleButtonApproval não encontrado');
                        await interaction.reply({ content: 'Este botão não está configurado corretamente.', ephemeral: true });
                    }
                }
            }
            // Botão para o comando wlnew
            else if (customId === 'start_whitelist_new') {
                const wlNewCommand = client.commands.get('wlnew');
                if (wlNewCommand) {
                    await wlNewCommand.handleButton(interaction, client);
                }
            }
            // Botões relacionados ao sistema de punição
            else if (customId.startsWith('punish_') || customId.startsWith('revoke_')) {
                try {
                    // Esta lógica seria implementada no módulo de punição
                    const punishmentSystem = require('./modules/punishment');
                    if (punishmentSystem.handlePunishmentButton) {
                        await punishmentSystem.handlePunishmentButton(interaction, client);
                    } else {
                        await interaction.reply({ content: 'Função de tratamento de botão de punição não encontrada.', ephemeral: true });
                    }
                } catch (error) {
                    console.error('❌ Erro ao processar botão de punição:', error);
                    await interaction.reply({ content: 'Erro ao processar esta ação.', ephemeral: true });
                }
            }
        }
        
        // Modais
        else if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            
            if (customId === 'whitelist_modal') {
                const whitelistCommand = client.commands.get('whitelist');
                if (whitelistCommand) {
                    await whitelistCommand.handleModal(interaction, client);
                }
            }
            else if (customId === 'whitelist_modal_new') {
                const wlNewCommand = client.commands.get('wlnew');
                if (wlNewCommand) {
                    await wlNewCommand.handleModal(interaction, client);
                }
            }
            else if (customId.startsWith('rejection_reason_modal')) {
                const manageWhitelist = client.commands.get('managewhitelist');
                if (manageWhitelist && manageWhitelist.handleModalRejection) {
                    await manageWhitelist.handleModalRejection(interaction, client);
                } else {
                    const whitelistCommand = client.commands.get('whitelist');
                    if (whitelistCommand && whitelistCommand.handleModalRejection) {
                        await whitelistCommand.handleModalRejection(interaction, client);
                    } else {
                        console.error('❌ Método handleModalRejection não encontrado');
                        await interaction.reply({ content: 'Este modal não está configurado corretamente.', ephemeral: true });
                    }
                }
            }
            // Modais relacionados ao sistema de punição
            else if (customId.startsWith('punish_reason_') || customId.startsWith('appeal_')) {
                try {
                    // Esta lógica seria implementada no módulo de punição
                    const punishmentSystem = require('./modules/punishment');
                    if (punishmentSystem.handlePunishmentModal) {
                        await punishmentSystem.handlePunishmentModal(interaction, client);
                    } else {
                        await interaction.reply({ content: 'Função de tratamento de modal de punição não encontrada.', ephemeral: true });
                    }
                } catch (error) {
                    console.error('❌ Erro ao processar modal de punição:', error);
                    await interaction.reply({ content: 'Erro ao processar esta ação.', ephemeral: true });
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro geral na interação:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Ocorreu um erro ao processar esta interação.', ephemeral: true });
            } else {
                await interaction.editReply({ content: 'Ocorreu um erro ao processar esta interação.' });
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

client.login(token);
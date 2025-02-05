const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { execute, handleButton, handleModal, handleButtonApproval } = require('./commands/whitelist');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;

// Registrando comandos
async function registerCommands() {
    const commands = [
        {
            name: 'whitelist',
            description: 'Inicia o processo de whitelist para o usuário.',
        }
    ];

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('📤 Registrando comandos...');
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('✅ Comandos registrados!');
    } catch (error) {
        console.error(`❌ Erro ao registrar comandos: ${error}`);
    }
}

// Evento quando o bot estiver pronto
client.once('ready', () => {
    console.log(`✅ Bot está online como ${client.user.tag}`);
    registerCommands();
});

// Evento de interação (quando um comando ou botão é invocado)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    // Verificando comando /whitelist
    if (interaction.isCommand() && interaction.commandName === 'whitelist') {
        try {
            console.log('🔹 Comando /whitelist foi chamado');
            await execute(interaction, client);
        } catch (error) {
            console.error('❌ Erro ao processar o comando /whitelist:', error);
        }
    }

    // Verificando interação com o botão 'start_whitelist'
    if (interaction.isButton() && interaction.customId === 'start_whitelist') {
        try {
            await handleButton(interaction, client);
        } catch (error) {
            console.error('❌ Erro ao processar interação do botão "start_whitelist":', error);
        }
    }

    // Verificando se a interação é do modal
    if (interaction.isModalSubmit() && interaction.customId === 'whitelist_modal') {
        try {
            await handleModal(interaction, client);
        } catch (error) {
            console.error('❌ Erro ao processar o modal:', error);
        }
    }

    // Lógica para lidar com aprovação ou rejeição de whitelist
    if (interaction.isButton() && (interaction.customId === 'approve_whitelist' || interaction.customId === 'reject_whitelist')) {
        try {
            await handleButtonApproval(interaction, client);
        } catch (error) {
            console.error('❌ Erro ao processar aprovação/rejeição de whitelist:', error);
        }
    }
});

client.login(token);

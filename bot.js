const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { token } = require('dotenv').config();
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Carrega os comandos
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

// Carrega os eventos
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Interações (botões, modais, etc.)
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const command = client.commands.get('whitelist');
        if (command) command.handleButton(interaction, client);
    } else if (interaction.isModalSubmit()) {
        const command = client.commands.get('whitelist');
        if (command) command.handleModal(interaction, client);
    } else if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Ocorreu um erro ao executar o comando.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
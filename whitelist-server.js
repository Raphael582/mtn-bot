const express = require('express');
const cors = require('cors');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config/whitelist.config');
const apiRoutes = require('./routes/api');
const dataManager = require('./modules/dataManager');
require('dotenv').config();

const app = express();

// Criar cliente Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

// Login do bot
client.login(process.env.TOKEN);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'whitelist-frontend')));

// Compartilhar cliente Discord com as rotas
app.locals.client = client;

// Rotas
app.use('/api', apiRoutes);

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'whitelist-frontend', 'index.html'));
});

// Rota para o formulário
app.get('/form', (req, res) => {
    res.sendFile(path.join(__dirname, 'whitelist-frontend', 'form.html'));
});

// Rota para o painel admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'whitelist-frontend', 'admin.html'));
});

// Inicializar o gerenciador de dados
async function initialize() {
    try {
        await dataManager.initialize();
        console.log('✅ Gerenciador de dados inicializado com sucesso');
    } catch (error) {
        console.error('❌ Erro ao inicializar gerenciador de dados:', error);
        process.exit(1);
    }
}

// Iniciar o servidor
async function startServer() {
    try {
        await initialize();
        
        app.listen(config.port, config.host, () => {
            console.log(`
🚀 Servidor Whitelist iniciado
📡 URL: http://${config.host}:${config.port}
📝 Painel Admin: http://${config.host}:${config.port}/admin
            `);
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promessa rejeitada não tratada:', error);
    process.exit(1);
});

// Iniciar o servidor
startServer(); 
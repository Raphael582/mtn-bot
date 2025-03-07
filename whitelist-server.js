const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const whitelistRoutes = require('./routes/whitelist');
const adminRoutes = require('./routes/admin');
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

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB'))
    .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Rotas
app.use('/api/whitelist', whitelistRoutes);
app.use('/api/admin', adminRoutes);

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

// Rota para o gerenciamento de administradores
app.get('/admin-manage', (req, res) => {
    res.sendFile(path.join(__dirname, 'whitelist-frontend', 'admin-manage.html'));
});

// Tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 
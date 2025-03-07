const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const dataManager = require('../modules/dataManager');
const autoVerification = require('../modules/autoVerification');
const { EmbedBuilder } = require('discord.js');

// Middleware para validar token
const validateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// Função para enviar mensagem privada ao usuário
async function sendPrivateMessage(client, userId, embed) {
    try {
        const user = await client.users.fetch(userId);
        await user.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erro ao enviar mensagem privada:', error);
    }
}

// Função para adicionar cargo ao usuário
async function addRole(client, userId, roleId) {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(roleId);
    } catch (error) {
        console.error('Erro ao adicionar cargo:', error);
    }
}

// Função para remover cargo do usuário
async function removeRole(client, userId, roleId) {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.remove(roleId);
    } catch (error) {
        console.error('Erro ao remover cargo:', error);
    }
}

// Enviar solicitação
router.post('/submit', validateToken, async (req, res) => {
    try {
        const request = await dataManager.addWhitelistRequest(req.user.userId, req.body);
        res.json(request);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Aprovar solicitação
router.post('/approve/:id', async (req, res) => {
    try {
        const request = await dataManager.updateWhitelistRequest(req.params.id, 'aprovado');
        await autoVerification.verifyMember(request.userId);
        
        // Criar embed para mensagem de aprovação
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎉 Solicitação Aprovada!')
            .setDescription(`Olá ${request.nome}!`)
            .setThumbnail('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67cbd351&is=67ca81d1&hm=2d1e12af5d853f0e88f8db96a6f4c74728e460faf6de2b8731eed8588739c11c&=&format=webp&width=914&height=930')
            .addFields(
                { name: 'Status', value: '✅ Aprovado', inline: true },
                { name: 'Nome', value: request.nome, inline: true },
                { name: 'Data', value: new Date().toLocaleString('pt-BR'), inline: true }
            )
            .setFooter({ text: 'Metânia' })
            .setTimestamp();
        
        // Enviar mensagem privada
        await sendPrivateMessage(req.app.locals.client, request.userId, embed);
        
        // Adicionar cargo
        await addRole(req.app.locals.client, request.userId, process.env.ROLE_ACESS);
        
        res.json(request);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Rejeitar solicitação
router.post('/reject/:id', async (req, res) => {
    try {
        const { reason } = req.body;
        const request = await dataManager.updateWhitelistRequest(req.params.id, 'rejeitado', reason);
        await autoVerification.removeWhitelist(request.userId, reason);
        
        // Criar embed para mensagem de rejeição
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('❌ Solicitação Rejeitada')
            .setDescription(`Olá ${request.nome}!`)
            .setThumbnail('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67cbd351&is=67ca81d1&hm=2d1e12af5d853f0e88f8db96a6f4c74728e460faf6de2b8731eed8588739c11c&=&format=webp&width=914&height=930')
            .addFields(
                { name: 'Status', value: '❌ Rejeitado', inline: true },
                { name: 'Nome', value: request.nome, inline: true },
                { name: 'Data', value: new Date().toLocaleString('pt-BR'), inline: true },
                { name: 'Motivo', value: reason }
            )
            .setFooter({ text: 'Metânia' })
            .setTimestamp();
        
        // Enviar mensagem privada
        await sendPrivateMessage(req.app.locals.client, request.userId, embed);
        
        res.json(request);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Listar solicitações pendentes
router.get('/pending', async (req, res) => {
    try {
        const requests = await dataManager.getPendingRequests();
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter solicitação por ID
router.get('/:id', async (req, res) => {
    try {
        const request = await dataManager.getRequestById(req.params.id);
        if (!request) {
            return res.status(404).json({ error: 'Solicitação não encontrada' });
        }
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Resetar cooldown de um usuário
router.post('/reset-cooldown/:userId', async (req, res) => {
    try {
        await dataManager.resetCooldown(req.params.userId);
        res.json({ message: 'Cooldown resetado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verificar cooldown de um usuário
router.get('/cooldown/:userId', async (req, res) => {
    try {
        const cooldown = await dataManager.getCooldown(req.params.userId);
        res.json({ cooldown });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 
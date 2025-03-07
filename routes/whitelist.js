const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const dataManager = require('../modules/dataManager');
const { EmbedBuilder } = require('discord.js');

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

// Enviar solicitação de whitelist
router.post('/submit', async (req, res) => {
    try {
        const { discordName, discordId, characterName, characterStory, rpExperience } = req.body;
        
        const request = await dataManager.addWhitelistRequest({
            discordName,
            discordId,
            characterName,
            characterStory,
            rpExperience
        });
        
        res.status(201).json({ message: 'Solicitação enviada com sucesso', request });
    } catch (error) {
        console.error('Erro ao enviar solicitação:', error);
        res.status(500).json({ error: 'Erro ao enviar solicitação' });
    }
});

// Aprovar solicitação
router.post('/approve/:id', async (req, res) => {
    try {
        const request = await dataManager.updateWhitelistRequest(req.params.id, 'approved');
        
        // Criar embed para mensagem de aprovação
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎉 Solicitação Aprovada!')
            .setDescription(`Olá ${request.discordName}!`)
            .setThumbnail('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67cbd351&is=67ca81d1&hm=2d1e12af5d853f0e88f8db96a6f4c74728e460faf6de2b8731eed8588739c11c&=&format=webp&width=914&height=930')
            .addFields(
                { name: 'Status', value: '✅ Aprovado', inline: true },
                { name: 'Personagem', value: request.characterName, inline: true },
                { name: 'Data', value: new Date().toLocaleString('pt-BR'), inline: true }
            )
            .setFooter({ text: 'Metânia RP' })
            .setTimestamp();
        
        // Enviar mensagem privada
        await sendPrivateMessage(req.app.locals.client, request.discordId, embed);
        
        // Adicionar cargo
        await addRole(req.app.locals.client, request.discordId, process.env.ROLE_ACESS);
        
        res.json({ message: 'Solicitação aprovada com sucesso' });
    } catch (error) {
        console.error('Erro ao aprovar solicitação:', error);
        res.status(500).json({ error: 'Erro ao aprovar solicitação' });
    }
});

// Rejeitar solicitação
router.post('/reject/:id', async (req, res) => {
    try {
        const { reason } = req.body;
        const request = await dataManager.updateWhitelistRequest(req.params.id, 'rejected', reason);
        
        // Criar embed para mensagem de rejeição
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('❌ Solicitação Rejeitada')
            .setDescription(`Olá ${request.discordName}!`)
            .setThumbnail('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67cbd351&is=67ca81d1&hm=2d1e12af5d853f0e88f8db96a6f4c74728e460faf6de2b8731eed8588739c11c&=&format=webp&width=914&height=930')
            .addFields(
                { name: 'Status', value: '❌ Rejeitado', inline: true },
                { name: 'Personagem', value: request.characterName, inline: true },
                { name: 'Data', value: new Date().toLocaleString('pt-BR'), inline: true },
                { name: 'Motivo', value: reason }
            )
            .setFooter({ text: 'Metânia RP' })
            .setTimestamp();
        
        // Enviar mensagem privada
        await sendPrivateMessage(req.app.locals.client, request.discordId, embed);
        
        res.json({ message: 'Solicitação rejeitada com sucesso' });
    } catch (error) {
        console.error('Erro ao rejeitar solicitação:', error);
        res.status(500).json({ error: 'Erro ao rejeitar solicitação' });
    }
});

// Listar solicitações pendentes
router.get('/pending', async (req, res) => {
    try {
        const requests = await dataManager.getPendingRequests();
        res.json(requests);
    } catch (error) {
        console.error('Erro ao listar solicitações:', error);
        res.status(500).json({ error: 'Erro ao listar solicitações' });
    }
});

module.exports = router; 
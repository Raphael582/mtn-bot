const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const jwt = require('jsonwebtoken');
const config = require('../config/whitelist.config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Gera um link para solicitar whitelist'),

    async execute(interaction) {
        try {
            // Gerar token JWT
            const token = jwt.sign(
                { userId: interaction.user.id },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Construir URL do formulário
            const formUrl = `${config.server.url}/form?token=${token}`;

            // Criar embed informativo
            const embed = new EmbedBuilder()
                .setTitle('🎮 Sistema de Whitelist')
                .setDescription(`Olá ${interaction.user}! Para solicitar sua whitelist, siga os passos abaixo:`)
                .setColor('#3b82f6')
                .addFields(
                    { name: '1️⃣ Clique no Botão', value: 'Clique no botão abaixo para acessar o formulário' },
                    { name: '2️⃣ Preencha o Formulário', value: 'Preencha todas as informações solicitadas' },
                    { name: '3️⃣ Aguarde a Resposta', value: 'Nossa equipe irá analisar sua solicitação' },
                    { name: '💡 Dica', value: 'Use seu nome do Discord para facilitar a identificação' },
                    { name: '⚠️ Importante', value: 'Você só pode enviar uma solicitação por vez' }
                )
                .setTimestamp();

            // Criar botão com URL
            const button = new ButtonBuilder()
                .setLabel('Solicitar Whitelist')
                .setStyle(ButtonStyle.Link)
                .setURL(formUrl);

            const row = new ActionRowBuilder()
                .addComponents(button);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
        } catch (error) {
            console.error('Erro ao executar comando whitelist:', error);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao gerar o link. Tente novamente mais tarde.',
                ephemeral: true
            });
        }
    }
};
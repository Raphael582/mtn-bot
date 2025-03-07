const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const jwt = require('jsonwebtoken');
const config = require('../config/whitelist.config');
const env = require('../modules/env');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Gera um link para solicitar whitelist'),

    async execute(interaction) {
        try {
            // Verificar se o usuário já tem uma solicitação pendente
            const existingRequest = Object.values(global.whitelistServer?.db?.forms || {}).find(
                f => f.userId === interaction.user.id && f.status === 'pendente'
            );
            
            if (existingRequest) {
                return interaction.reply({
                    content: '❌ Você já possui uma solicitação de whitelist pendente. Aguarde a resposta da equipe.',
                    ephemeral: true
                });
            }

            // Gerar token JWT com mais informações
            const token = jwt.sign({ 
                userId: interaction.user.id,
                username: interaction.user.tag,
                timestamp: Date.now()
            }, env.JWT_SECRET, { expiresIn: '1h' });

            // Construir URL do formulário com o token
            const serverUrl = config.server.url;
            const formUrl = `${serverUrl}/form.html?token=${encodeURIComponent(token)}`;
            const adminUrl = `${serverUrl}/admin.html`;

            // Criar embed informativo
            const embed = new EmbedBuilder()
                .setTitle('🎮 Sistema de Whitelist - Metânia')
                .setDescription(`Olá ${interaction.user}! Para solicitar sua whitelist, siga os passos abaixo:`)
                .setColor('#3b82f6')
                .setThumbnail('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67cbd351&is=67ca81d1&hm=2d1e12af5d853f0e88f8db96a6f4c74728e460faf6de2b8731eed8588739c11c&=&format=webp&width=914&height=930')
                .addFields(
                    { name: '1️⃣ Clique no Botão', value: 'Clique no botão abaixo para acessar o formulário' },
                    { name: '2️⃣ Preencha o Formulário', value: 'Preencha todas as informações solicitadas' },
                    { name: '3️⃣ Aguarde a Resposta', value: 'Nossa equipe irá analisar sua solicitação' },
                    { name: '💡 Dica', value: 'Use seu nome do Discord para facilitar a identificação' },
                    { name: '⚠️ Importante', value: 'Você só pode enviar uma solicitação por vez' }
                )
                .setFooter({ text: 'Metânia - Sistema de Whitelist' })
                .setTimestamp();

            // Criar botões
            const whitelistButton = new ButtonBuilder()
                .setLabel('Solicitar Whitelist')
                .setStyle(ButtonStyle.Link)
                .setURL(formUrl)
                .setEmoji('📝');

            const adminButton = new ButtonBuilder()
                .setLabel('Painel Admin')
                .setStyle(ButtonStyle.Link)
                .setURL(adminUrl)
                .setEmoji('⚙️');

            const row = new ActionRowBuilder()
                .addComponents(whitelistButton, adminButton);

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
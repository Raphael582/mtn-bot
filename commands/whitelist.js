const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Solicite sua whitelist no servidor'),
        
    async execute(interaction) {
        try {
            // Gerar link único para o usuário
            const formUrl = `${process.env.WHITELIST_URL}/form/${interaction.user.id}`;
            
            // Criar embed com instruções
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
            
            // Criar botão para acessar o formulário
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Acessar Formulário')
                        .setStyle(ButtonStyle.Primary)
                        .setURL(formUrl)
                );
            
            // Responder com embed e botão
            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Erro ao executar comando whitelist:', error);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.',
                ephemeral: true
            });
        }
    }
};
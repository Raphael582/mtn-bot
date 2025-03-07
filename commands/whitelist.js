const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Gerencia o sistema de whitelist')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Verifica o status da sua solicitação de whitelist'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('form')
                .setDescription('Gera um link para o formulário de whitelist')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            try {
                const response = await fetch(`${process.env.WHITELIST_URL}/api/whitelist/forms`);
                const forms = await response.json();
                
                const userForm = forms.find(f => f.nome === interaction.user.username);
                
                if (!userForm) {
                    return interaction.reply({
                        content: 'Você ainda não enviou uma solicitação de whitelist.',
                        ephemeral: true
                    });
                }

                const statusEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('📝 Status da Whitelist')
                    .setDescription(`Status da sua solicitação: **${userForm.status.toUpperCase()}**`)
                    .addFields(
                        { name: 'Data de Envio', value: new Date(userForm.dataEnvio).toLocaleDateString('pt-BR'), inline: true },
                        { name: 'Estado', value: userForm.estado, inline: true },
                        { name: 'Idade', value: userForm.idade, inline: true }
                    )
                    .setTimestamp();

                if (userForm.status === 'rejeitado') {
                    statusEmbed.addFields({ name: 'Motivo da Rejeição', value: userForm.motivoRejeicao });
                }

                return interaction.reply({ embeds: [statusEmbed], ephemeral: true });
            } catch (error) {
                console.error('Erro ao verificar status:', error);
                return interaction.reply({
                    content: 'Ocorreu um erro ao verificar o status da sua solicitação.',
                    ephemeral: true
                });
            }
        } else if (subcommand === 'form') {
            const formEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📝 Formulário de Whitelist')
                .setDescription('Clique no botão abaixo para acessar o formulário de whitelist.')
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Acessar Formulário')
                        .setStyle(ButtonStyle.Link)
                        .setURL(process.env.WHITELIST_URL)
                );

            return interaction.reply({
                embeds: [formEmbed],
                components: [row]
            });
        }
    }
};
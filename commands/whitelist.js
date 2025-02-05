const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: {
        name: 'whitelist',
        description: 'Inicia o processo de whitelist.',
    },
    async execute(interaction, client) {
        // Botão para iniciar o questionário
        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_whitelist')
                .setLabel('Iniciar Whitelist')
                .setStyle(ButtonStyle.Primary),
        );

        await interaction.reply({
            content: 'Clique no botão abaixo para iniciar o processo de whitelist.',
            components: [button],
        });
    },
    async handleButton(interaction, client) {
        if (interaction.customId === 'start_whitelist') {
            // Modal (popup) para o questionário
            const modal = new ModalBuilder()
                .setCustomId('whitelist_modal')
                .setTitle('Formulário de Whitelist');

            const questions = [
                new TextInputBuilder()
                    .setCustomId('nome')
                    .setLabel('Qual é o seu nome?')
                    .setStyle(TextInputStyle.Short),
                new TextInputBuilder()
                    .setCustomId('idade')
                    .setLabel('Qual é a sua idade?')
                    .setStyle(TextInputStyle.Short),
                new TextInputBuilder()
                    .setCustomId('motivo')
                    .setLabel('Por que você quer entrar?')
                    .setStyle(TextInputStyle.Paragraph),
            ];

            const actionRows = questions.map(question =>
                new ActionRowBuilder().addComponents(question),
            );

            modal.addComponents(...actionRows);
            await interaction.showModal(modal);
        }
    },
    async handleModal(interaction, client) {
        if (interaction.customId === 'whitelist_modal') {
            const nome = interaction.fields.getTextInputValue('nome');
            const idade = interaction.fields.getTextInputValue('idade');
            const motivo = interaction.fields.getTextInputValue('motivo');

            // Envia o formulário para o canal de logs
            const logChannel = interaction.guild.channels.cache.find(
                channel => channel.name === 'logs-wl',
            );

            if (logChannel) {
                const embed = {
                    title: 'Nova Solicitação de Whitelist',
                    fields: [
                        { name: 'Nome', value: nome },
                        { name: 'Idade', value: idade },
                        { name: 'Motivo', value: motivo },
                    ],
                    footer: { text: `Solicitante: ${interaction.user.tag}` },
                };

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('approve_whitelist')
                        .setLabel('Aprovar')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('reject_whitelist')
                        .setLabel('Rejeitar')
                        .setStyle(ButtonStyle.Danger),
                );

                await logChannel.send({
                    embeds: [embed],
                    components: [buttons],
                });

                await interaction.reply({
                    content: 'Seu formulário foi enviado para análise!',
                    ephemeral: true,
                });
            }
        } else if (interaction.customId === 'approve_whitelist' || interaction.customId === 'reject_whitelist') {
            // Aprovação ou rejeição da whitelist
            const targetUser = interaction.message.embeds[0].footer.text.split(': ')[1];
            const member = interaction.guild.members.cache.find(
                m => m.user.tag === targetUser,
            );

            if (interaction.customId === 'approve_whitelist') {
                const accessRole = interaction.guild.roles.cache.find(
                    role => role.name === 'Acess',
                );
                await member.roles.add(accessRole);
                await member.send('Parabéns! Sua whitelist foi aprovada.');
                await interaction.reply({ content: 'Whitelist aprovada!', ephemeral: true });
            } else {
                await member.send('Infelizmente, sua whitelist foi rejeitada.');
                await interaction.reply({ content: 'Whitelist rejeitada!', ephemeral: true });
            }

            // Remove os botões após a interação
            await interaction.message.edit({ components: [] });
        }
    },
};
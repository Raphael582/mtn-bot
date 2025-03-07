const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Acesse o formulário de whitelist ou verifique seu status')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Verifica o status da sua solicitação de whitelist')),

    async execute(interaction) {
        try {
            // Verificar se é um subcomando
            const subcommand = interaction.options.getSubcommand(false);

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
            } else {
                // Comportamento padrão: enviar formulário
                const formEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('📝 Formulário de Whitelist')
                    .setDescription(`Olá ${interaction.user.username}! Aqui está o formulário de whitelist.`)
                    .addFields(
                        { name: '📋 Instruções', value: '1. Clique no botão para acessar o formulário\n2. Preencha todas as informações corretamente\n3. Envie o formulário e aguarde a aprovação' },
                        { name: '💡 Dica', value: 'Use o mesmo nome do seu Discord para facilitar o acompanhamento do status.' }
                    )
                    .setImage('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67c93051&is=67c7ded1&hm=a337ccc36d99cb5360371bfa81955bc8b14ddb78ed722cec120421d3460a8d34&=&format=webp&width=651&height=663')
                    .setFooter({ text: 'Desenvolvido para Metânia por Mr.Dark' })
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Acessar Formulário')
                            .setStyle(ButtonStyle.Link)
                            .setURL(process.env.WHITELIST_URL)
                            .setEmoji('📝')
                    );

                return interaction.reply({
                    embeds: [formEmbed],
                    components: [row]
                });
            }
        } catch (error) {
            console.error('Erro no comando whitelist:', error);
            return interaction.reply({
                content: 'Ocorreu um erro ao executar este comando. Por favor, tente novamente.',
                ephemeral: true
            });
        }
    }
};
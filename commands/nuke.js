// Versão corrigida do commands/nuke.js
const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('🔥 Limpa o canal atual apagando as mensagens. (Requer permissão de Gerenciar Canais)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.channel.isTextBased() || interaction.channel.type === ChannelType.DM) {
            return await interaction.reply({ content: 'Este comando só pode ser usado em canais de texto em servidores, não em DMs.', ephemeral: true });
        }

        const channel = interaction.channel;

        try {
            await interaction.deferReply({ ephemeral: true });

            const position = channel.position;
            const newChannel = await channel.clone();
            await channel.delete();

            newChannel.setPosition(position);
            await newChannel.send('🔥 Canal limpo com sucesso! 🔥');

            const embedLogNuke = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔥 Canal NUKADO! 🔥')
                .setDescription(`O canal <#${newChannel.id}> foi limpo por ${interaction.user.tag} (ID: ${interaction.user.id}).`)
                .addFields(
                    { name: '👮‍♂️ Mod Responsável', value: `${interaction.user.tag} (ID: ${interaction.user.id})`, inline: true },
                    { name: '💥 Canal Nukado', value: `<#${newChannel.id}>`, inline: true }
                )
                .setTimestamp();

            await newChannel.send({ embeds: [embedLogNuke] });
            await interaction.editReply({ content: 'Canal limpo com sucesso! 🔥', ephemeral: true });
        } catch (error) {
            console.error("❌ Erro ao nukar o canal:", error);
            await interaction.editReply({ content: '❌ Falha ao limpar o canal.', ephemeral: true });
        }
    }
};
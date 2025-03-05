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
            // Informar que o processo começou
            await interaction.reply({ content: 'Iniciando processo de limpeza do canal...', ephemeral: true });

            // Clonar o canal e reposicioná-lo
            const position = channel.position;
            const newChannel = await channel.clone();
            await channel.delete();
            await newChannel.setPosition(position);

            // Enviar mensagem no novo canal
            const embedLogNuke = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔥 Canal NUKADO! 🔥')
                .setDescription(`O canal foi limpo por ${interaction.user.tag} (ID: ${interaction.user.id}).`)
                .addFields(
                    { name: '👮‍♂️ Mod Responsável', value: `${interaction.user.tag} (ID: ${interaction.user.id})`, inline: true }
                )
                .setTimestamp();

            await newChannel.send({ content: '🔥 Canal limpo com sucesso! 🔥', embeds: [embedLogNuke] });
            
            // Não precisamos atualizar a resposta inicial, pois o canal foi excluído
        } catch (error) {
            console.error("❌ Erro ao nukar o canal:", error);
            
            // Em caso de erro, tente responder de uma forma que não dependa da interação original
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ Falha ao limpar o canal.', ephemeral: true }).catch(e => {});
                } else {
                    await interaction.reply({ content: '❌ Falha ao limpar o canal.', ephemeral: true }).catch(e => {});
                }
            } catch (e) {
                console.error("Não foi possível responder à interação:", e);
            }
        }
    }
};
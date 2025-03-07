const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Logger = require('../modules/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Comandos de moderação')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName('warn')
                .setDescription('Avisa um usuário')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para avisar')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('motivo')
                        .setDescription('Motivo do aviso')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('timeout')
                .setDescription('Aplica timeout temporário')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para dar timeout')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('minutos')
                        .setDescription('Duração do timeout em minutos')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('motivo')
                        .setDescription('Motivo do timeout')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban')
                .setDescription('Bane um usuário')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para banir')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('motivo')
                        .setDescription('Motivo do ban')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unban')
                .setDescription('Remove banimento de um usuário')
                .addStringOption(option =>
                    option.setName('usuario')
                        .setDescription('ID do usuário para desbanir')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Limpa mensagens do canal')
                .addIntegerOption(option =>
                    option.setName('quantidade')
                        .setDescription('Quantidade de mensagens para limpar')
                        .setRequired(true))),

    async execute(interaction) {
        const logger = new Logger(interaction.client);
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'warn':
                    await handleWarn(interaction, logger);
                    break;
                case 'timeout':
                    await handleTimeout(interaction, logger);
                    break;
                case 'ban':
                    await handleBan(interaction, logger);
                    break;
                case 'unban':
                    await handleUnban(interaction, logger);
                    break;
                case 'clear':
                    await handleClear(interaction, logger);
                    break;
            }
        } catch (error) {
            console.error('Erro ao executar comando de moderação:', error);
            await interaction.reply({
                content: 'Ocorreu um erro ao executar o comando.',
                ephemeral: true
            });
        }
    }
};

async function handleWarn(interaction, logger) {
    const user = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo');

    const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⚠️ Aviso')
        .setDescription(`Você foi avisado por ${interaction.user.tag}`)
        .setThumbnail('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67cbd351&is=67ca81d1&hm=2d1e12af5d853f0e88f8db96a6f4c74728e460faf6de2b8731eed8588739c11c&=&format=webp&width=914&height=930')
        .addFields(
            { name: 'Motivo', value: reason }
        )
        .setTimestamp();

    try {
        await user.send({ embeds: [embed] });
        await logger.logPunishment(user, 'Aviso', reason, interaction.user);
        await interaction.reply({
            content: `✅ ${user.tag} foi avisado com sucesso!`,
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: 'Não foi possível enviar mensagem privada para o usuário.',
            ephemeral: true
        });
    }
}

async function handleTimeout(interaction, logger) {
    const user = interaction.options.getMember('usuario');
    const minutes = interaction.options.getInteger('minutos');
    const reason = interaction.options.getString('motivo');

    try {
        await user.timeout(minutes * 60 * 1000, reason);
        await logger.logPunishment(user, `Timeout (${minutes}min)`, reason, interaction.user);
        await interaction.reply({
            content: `✅ ${user.user.tag} recebeu timeout por ${minutes} minutos!`,
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: 'Não foi possível aplicar o timeout.',
            ephemeral: true
        });
    }
}

async function handleBan(interaction, logger) {
    const user = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo');

    try {
        await interaction.guild.members.ban(user, { reason });
        await logger.logPunishment(user, 'Ban', reason, interaction.user);
        await interaction.reply({
            content: `✅ ${user.tag} foi banido com sucesso!`,
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: 'Não foi possível banir o usuário.',
            ephemeral: true
        });
    }
}

async function handleUnban(interaction, logger) {
    const userId = interaction.options.getString('usuario');

    try {
        await interaction.guild.members.unban(userId);
        await logger.log('SUCCESS', 'Usuário Desbanido', `ID: ${userId}`, [
            { name: 'Desbanido por', value: interaction.user.tag }
        ]);
        await interaction.reply({
            content: `✅ Usuário desbanido com sucesso!`,
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: 'Não foi possível desbanir o usuário.',
            ephemeral: true
        });
    }
}

async function handleClear(interaction, logger) {
    const amount = interaction.options.getInteger('quantidade');

    if (amount < 1 || amount > 100) {
        return await interaction.reply({
            content: 'A quantidade deve estar entre 1 e 100.',
            ephemeral: true
        });
    }

    try {
        await interaction.channel.bulkDelete(amount);
        await logger.log('SUCCESS', 'Mensagens Limpas', 
            `${amount} mensagens foram limpas no canal ${interaction.channel.name}`,
            [{ name: 'Limpo por', value: interaction.user.tag }]
        );
        await interaction.reply({
            content: `✅ ${amount} mensagens foram limpas!`,
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: 'Não foi possível limpar as mensagens.',
            ephemeral: true
        });
    }
} 
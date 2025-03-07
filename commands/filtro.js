const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filtro')
        .setDescription('Gerenciar o sistema de filtro de chat')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Mostra o status atual do filtro'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Ativa ou desativa o filtro')
                .addBooleanOption(option =>
                    option.setName('ativado')
                        .setDescription('Se o filtro deve estar ativado')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('admin')
                .setDescription('Configura se o filtro deve pegar em administradores')
                .addBooleanOption(option =>
                    option.setName('ativado')
                        .setDescription('Se o filtro deve pegar em administradores')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('whitelist')
                .setDescription('Gerenciar whitelist do filtro')
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de whitelist')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Cargo', value: 'role' },
                            { name: 'Canal', value: 'channel' },
                            { name: 'Usuário', value: 'user' }
                        ))
                .addStringOption(option =>
                    option.setName('acao')
                        .setDescription('Ação a ser executada')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Adicionar', value: 'add' },
                            { name: 'Remover', value: 'remove' }
                        ))
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID do cargo, canal ou usuário')
                        .setRequired(true))),

    async execute(interaction) {
        // Verificar permissões
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para gerenciar o filtro.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        // Obter instância do filtro
        const chatFilter = interaction.client.chatFilter;

        try {
            switch (subcommand) {
                case 'status':
                    const embed = new EmbedBuilder()
                        .setTitle('📊 Status do Filtro')
                        .setColor('#2ecc71')
                        .addFields(
                            { name: 'Estado', value: chatFilter.config.enabled ? '✅ Ativado' : '❌ Desativado', inline: true },
                            { name: 'Filtrar Admins', value: chatFilter.config.filterAdmins ? '✅ Sim' : '❌ Não', inline: true },
                            { name: 'Cargos na Whitelist', value: chatFilter.config.whitelistedRoles.length.toString(), inline: true },
                            { name: 'Canais na Whitelist', value: chatFilter.config.whitelistedChannels.length.toString(), inline: true },
                            { name: 'Usuários na Whitelist', value: chatFilter.config.whitelistedUsers.length.toString(), inline: true }
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                    break;

                case 'toggle':
                    const enabled = interaction.options.getBoolean('ativado');
                    chatFilter.setEnabled(enabled);
                    await interaction.reply({
                        content: `✅ Filtro ${enabled ? 'ativado' : 'desativado'} com sucesso!`,
                        ephemeral: true
                    });
                    break;

                case 'admin':
                    const filterAdmins = interaction.options.getBoolean('ativado');
                    chatFilter.setFilterAdmins(filterAdmins);
                    await interaction.reply({
                        content: `✅ Filtro de administradores ${filterAdmins ? 'ativado' : 'desativado'} com sucesso!`,
                        ephemeral: true
                    });
                    break;

                case 'whitelist':
                    const tipo = interaction.options.getString('tipo');
                    const acao = interaction.options.getString('acao');
                    const id = interaction.options.getString('id');

                    switch (tipo) {
                        case 'role':
                            if (acao === 'add') {
                                chatFilter.addWhitelistedRole(id);
                            } else {
                                chatFilter.removeWhitelistedRole(id);
                            }
                            break;
                        case 'channel':
                            if (acao === 'add') {
                                chatFilter.addWhitelistedChannel(id);
                            } else {
                                chatFilter.removeWhitelistedChannel(id);
                            }
                            break;
                        case 'user':
                            if (acao === 'add') {
                                chatFilter.addWhitelistedUser(id);
                            } else {
                                chatFilter.removeWhitelistedUser(id);
                            }
                            break;
                    }

                    await interaction.reply({
                        content: `✅ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} ${acao === 'add' ? 'adicionado' : 'removido'} da whitelist com sucesso!`,
                        ephemeral: true
                    });
                    break;
            }
        } catch (error) {
            console.error('Erro ao executar comando de filtro:', error);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao executar o comando.',
                ephemeral: true
            });
        }
    }
}; 
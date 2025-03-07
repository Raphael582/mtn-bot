const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../modules/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testlog')
        .setDescription('Testa o sistema de logs')
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('O tipo de log para testar')
                .setRequired(true)
                .addChoices(
                    { name: 'Info', value: 'INFO' },
                    { name: 'Sucesso', value: 'SUCCESS' },
                    { name: 'Aviso', value: 'WARNING' },
                    { name: 'Erro', value: 'ERROR' },
                    { name: 'Filtro', value: 'FILTER' },
                    { name: 'Punição', value: 'PUNISH' },
                    { name: 'Whitelist', value: 'WHITELIST' }
                ))
        .addStringOption(option =>
            option.setName('mensagem')
                .setDescription('A mensagem para o log')
                .setRequired(true)),

    async execute(interaction) {
        try {
            const tipo = interaction.options.getString('tipo');
            const mensagem = interaction.options.getString('mensagem');
            const logger = new Logger(interaction.client);

            // Criar embed de teste
            const embed = new EmbedBuilder()
                .setTitle('📝 Teste de Log')
                .setColor('#3b82f6')
                .setThumbnail('https://cdn.discordapp.com/attachments/1336748568853090508/1344726203453542494/metania-logo.png')
                .addFields(
                    { name: 'Tipo de Log', value: tipo },
                    { name: 'Mensagem', value: mensagem }
                )
                .setTimestamp();

            // Registrar o teste no canal apropriado
            await logger.log(tipo, 'Teste de Log', 
                `Teste de log realizado por ${interaction.user.tag}`,
                [
                    { name: 'Mensagem', value: mensagem },
                    { name: 'Tipo', value: tipo }
                ]
            );

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Erro ao testar log:', error);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao testar o log. Tente novamente mais tarde.',
                ephemeral: true
            });
        }
    }
}; 
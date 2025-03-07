const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../modules/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testfilter')
        .setDescription('Testa o sistema de filtros')
        .addStringOption(option =>
            option.setName('texto')
                .setDescription('O texto para testar o filtro')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('O tipo de filtro para testar')
                .setRequired(true)
                .addChoices(
                    { name: 'Chat', value: 'chat' },
                    { name: 'Oraculo', value: 'oraculo' },
                    { name: 'Punicoes', value: 'punicoes' }
                )),

    async execute(interaction) {
        try {
            const texto = interaction.options.getString('texto');
            const tipo = interaction.options.getString('tipo');
            const logger = new Logger(interaction.client);

            // Criar embed de teste
            const embed = new EmbedBuilder()
                .setTitle('🔍 Teste de Filtro')
                .setColor('#3b82f6')
                .setThumbnail('https://cdn.discordapp.com/attachments/1336748568853090508/1344726203453542494/metania-logo.png')
                .addFields(
                    { name: 'Texto Testado', value: texto },
                    { name: 'Tipo de Filtro', value: tipo }
                )
                .setTimestamp();

            // Registrar o teste no canal apropriado
            await logger.log(tipo.toUpperCase(), 'Teste de Filtro', 
                `Teste de filtro realizado por ${interaction.user.tag}`,
                [
                    { name: 'Texto', value: texto },
                    { name: 'Tipo', value: tipo }
                ]
            );

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Erro ao testar filtro:', error);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao testar o filtro. Tente novamente mais tarde.',
                ephemeral: true
            });
        }
    }
}; 
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
                .setThumbnail('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67cbd351&is=67ca81d1&hm=2d1e12af5d853f0e88f8db96a6f4c74728e460faf6de2b8731eed8588739c11c&=&format=webp&width=914&height=930')
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
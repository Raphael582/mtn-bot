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
                .setThumbnail('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67cbd351&is=67ca81d1&hm=2d1e12af5d853f0e88f8db96a6f4c74728e460faf6de2b8731eed8588739c11c&=&format=webp&width=914&height=930')
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
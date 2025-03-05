// Versão corrigida do commands/botconfig.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botconfig')
        .setDescription('⚙️ Gerencia as configurações do bot (apenas para administradores)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction) {
        // Verificar permissões do usuário
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para gerenciar as configurações do bot.',
                ephemeral: true
            });
        }
        
        // Embed informativo
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('⚙️ Configurações do Bot')
            .setDescription('Use os comandos abaixo para gerenciar diferentes aspectos do bot.')
            .addFields(
                { name: '/filtro', value: 'Gerenciar o sistema de filtro de chat' },
                { name: '/admin', value: 'Acessar o painel administrativo completo' },
                { name: '/wlnew', value: 'Gerenciar o sistema de whitelist' }
            )
            .setFooter({ text: 'Configurações acessíveis apenas para administradores' })
            .setTimestamp();
        
        await interaction.reply({ 
            embeds: [embed],
            ephemeral: true
        });
    }
};
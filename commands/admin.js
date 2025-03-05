const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Referência para o servidor de whitelist
let whitelistServer = null;

module.exports = {
    data: {
        name: 'admin',
        description: '🔒 Acessa o painel administrativo (apenas para administradores)'
    },
    
    async execute(interaction, client) {
        // Verificar permissões do usuário
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para acessar o painel administrativo.',
                ephemeral: true
            });
        }
        
        // Verificar se o servidor web está rodando
        if (global.whitelistServer) {
            whitelistServer = global.whitelistServer;
        } else {
            const WhitelistServer = require('../modules/whitelist-server');
            
            try {
                whitelistServer = new WhitelistServer(client);
                await whitelistServer.start();
                global.whitelistServer = whitelistServer;
            } catch (error) {
                console.error('❌ Erro ao iniciar servidor de whitelist:', error);
                return await interaction.reply({
                    content: 'Erro ao iniciar o servidor de administração. Por favor, tente novamente mais tarde.',
                    ephemeral: true
                });
            }
        }
        
        try {
            // Determinar URL do painel admin
            const adminURL = `http://localhost:${whitelistServer.options.port}/admin.html`;
            
            // Criar embed informativo
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🔒 Painel Administrativo')
                .setDescription('Acesse o painel administrativo para gerenciar o servidor e as funcionalidades do bot.')
                .addFields(
                    { name: '🛠️ Funcionalidades', value: 
                        '• Gerenciar solicitações de whitelist\n' +
                        '• Configurar o sistema de filtro de chat\n' +
                        '• Ajustar configurações do bot\n' +
                        '• Visualizar logs de atividade'
                    },
                    { name: '👤 Credenciais', value: 'Use o nome de usuário e senha configurados no arquivo .env' }
                )
                .setFooter({ text: 'Painel acessível apenas para administradores' })
                .setTimestamp();
            
            // Botão para acessar o painel
            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Acessar Painel Administrativo')
                    .setStyle(ButtonStyle.Link)
                    .setURL(adminURL)
                    .setEmoji('🔒')
            );
            
            // Responder com link para o painel
            await interaction.reply({
                embeds: [embed],
                components: [button],
                ephemeral: true
            });
            
        } catch (error) {
            console.error('❌ Erro ao gerar link para painel administrativo:', error);
            await interaction.reply({
                content: 'Ocorreu um erro ao acessar o painel administrativo. Por favor, tente novamente mais tarde.',
                ephemeral: true
            });
        }
    }
};
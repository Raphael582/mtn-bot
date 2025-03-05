const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Referência para o servidor de whitelist
let whitelistServer = null;

module.exports = {
    data: {
        name: 'botconfig',
        description: '⚙️ Gerencia as configurações do bot (apenas para administradores)'
    },
    
    async execute(interaction, client) {
        // Verificar permissões do usuário
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para gerenciar as configurações do bot.',
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
                    content: 'Erro ao acessar as configurações do bot. Por favor, tente novamente mais tarde.',
                    ephemeral: true
                });
            }
        }

        // Obter subcomando
        const subCommand = interaction.options.getSubcommand(false);
        
        // Se não houver subcomando, mostrar status atual
        if (!subCommand) {
            return await showStatus(interaction, whitelistServer);
        }
        
        // Processar subcomandos
        switch (subCommand) {
            case 'whitelist':
                return await toggleWhitelist(interaction, whitelistServer);
            case 'filtro':
                return await toggleChatFilter(interaction, whitelistServer);
            case 'automod':
                return await toggleAutoMod(interaction, whitelistServer);
            default:
                return await showStatus(interaction, whitelistServer);
        }
    }
};

// Função para mostrar o status atual das configurações
async function showStatus(interaction, whitelistServer) {
    const settings = whitelistServer.db.botSettings;
    
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('⚙️ Configurações do Bot')
        .addFields(
            { 
                name: '📝 Sistema de Whitelist', 
                value: settings.whitelistSystem?.enabled ? '✅ Ativo' : '❌ Inativo',
                inline: true 
            },
            { 
                name: '🔍 Filtro de Chat', 
                value: settings.chatFilter?.enabled ? '✅ Ativo' : '❌ Inativo',
                inline: true 
            },
            { 
                name: '🛡️ Moderação Automática', 
                value: settings.autoModeration?.enabled ? '✅ Ativa' : '❌ Inativa',
                inline: true 
            }
        )
        .setFooter({ text: 'Use /botconfig <módulo> para ativar/desativar cada módulo' })
        .setTimestamp();
    
    return await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

// Função para ativar/desativar o sistema de whitelist
async function toggleWhitelist(interaction, whitelistServer) {
    const settings = whitelistServer.db.botSettings;
    
    // Inverter o estado atual
    settings.whitelistSystem.enabled = !settings.whitelistSystem.enabled;
    
    // Salvar configurações
    whitelistServer.saveBotSettings();
    
    // Registrar ação do administrador
    whitelistServer.logAdminActivity(
        interaction.user.tag,
        'atualizar_config_bot',
        { 
            ip: 'Discord Command',
            module: 'whitelist',
            enabled: settings.whitelistSystem.enabled
        }
    );
    
    // Responder ao usuário
    return await interaction.reply({
        content: `✅ Sistema de Whitelist foi ${settings.whitelistSystem.enabled ? 'ativado' : 'desativado'} com sucesso!`,
        ephemeral: true
    });
}

// Função para ativar/desativar o filtro de chat
async function toggleChatFilter(interaction, whitelistServer) {
    const settings = whitelistServer.db.botSettings;
    
    // Inverter o estado atual
    settings.chatFilter.enabled = !settings.chatFilter.enabled;
    
    // Salvar configurações
    whitelistServer.saveBotSettings();
    
    // Registrar ação do administrador
    whitelistServer.logAdminActivity(
        interaction.user.tag,
        'atualizar_config_bot',
        { 
            ip: 'Discord Command',
            module: 'chatfilter',
            enabled: settings.chatFilter.enabled
        }
    );
    
    // Responder ao usuário
    return await interaction.reply({
        content: `✅ Filtro de Chat foi ${settings.chatFilter.enabled ? 'ativado' : 'desativado'} com sucesso!`,
        ephemeral: true
    });
}

// Função para ativar/desativar a moderação automática
async function toggleAutoMod(interaction, whitelistServer) {
    const settings = whitelistServer.db.botSettings;
    
    // Inverter o estado atual
    settings.autoModeration.enabled = !settings.autoModeration.enabled;
    
    // Salvar configurações
    whitelistServer.saveBotSettings();
    
    // Registrar ação do administrador
    whitelistServer.logAdminActivity(
        interaction.user.tag,
        'atualizar_config_bot',
        { 
            ip: 'Discord Command',
            module: 'automod',
            enabled: settings.autoModeration.enabled
        }
    );
    
    // Responder ao usuário
    return await interaction.reply({
        content: `✅ Moderação Automática foi ${settings.autoModeration.enabled ? 'ativada' : 'desativada'} com sucesso!`,
        ephemeral: true
    });
}
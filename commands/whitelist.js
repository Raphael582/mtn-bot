const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

// Referência para o servidor de whitelist
let whitelistServer = null;

module.exports = {
    // Função para executar o comando de whitelist
    async execute(interaction, client) {
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
                    content: 'Erro ao iniciar o sistema de whitelist. Por favor, tente novamente mais tarde ou contate um administrador.',
                    ephemeral: true
                });
            }
        }

        try {
            // Verificar se o usuário já submeteu um formulário que está pendente
            const formsDb = whitelistServer?.db?.forms || {};
            
            // Verificar se o usuário já tem uma solicitação pendente
            const temPendente = Object.values(formsDb).some(form => 
                form.userId === interaction.user.id && 
                form.status === 'pendente'
            );
            
            if (temPendente) {
                return await interaction.reply({
                    content: 'Você já possui uma solicitação de whitelist pendente. Por favor, aguarde a análise da equipe.',
                    ephemeral: true
                });
            }
            
            // Verificar se o usuário já foi aprovado
            const temAprovado = Object.values(formsDb).some(form => 
                form.userId === interaction.user.id && 
                form.status === 'aprovado'
            );
            
            if (temAprovado) {
                return await interaction.reply({
                    content: 'Você já possui whitelist aprovada neste servidor!',
                    ephemeral: true
                });
            }

            // Criar link único para este usuário
            const whitelistLink = whitelistServer.createWhitelistLink(
                interaction.user.id,
                interaction.guild.id
            );

            if (!whitelistLink) {
                return await interaction.reply({
                    content: 'Não foi possível gerar seu link de whitelist. Pode ser que você já tenha uma solicitação pendente ou aprovada.',
                    ephemeral: true
                });
            }

            // Criar embed com o link
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📝 Sistema de Whitelist')
                .setDescription(`Olá ${interaction.user.username}! Clique no botão abaixo para acessar o formulário de whitelist.`)
                .addFields(
                    { name: '⏱️ Atenção', value: 'Este link é válido por **30 minutos**. Após esse período, você precisará gerar um novo.' },
                    { name: '📋 Instruções', value: '1. Clique no botão para abrir o formulário\n2. Preencha todas as informações corretamente\n3. Envie o formulário e aguarde a aprovação' }
                )
                .setFooter({ text: 'Acesse o site para preencher seu formulário completo' })
                .setTimestamp();

            // Botão para o link
            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Abrir Formulário de Whitelist')
                    .setStyle(ButtonStyle.Link)
                    .setURL(whitelistLink)
                    .setEmoji('📝'),
            );

            // Responder com o link
            await interaction.reply({
                embeds: [embed],
                components: [button],
                ephemeral: true
            });

        } catch (error) {
            console.error('❌ Erro ao gerar link de whitelist:', error);
            await interaction.reply({
                content: 'Ocorreu um erro ao gerar seu link de whitelist. Por favor, tente novamente mais tarde.',
                ephemeral: true
            });
        }
    },

    // Estas funções são mantidas para compatibilidade com o sistema antigo
    async handleButton(interaction, client) {
        // Redirecionar para o novo sistema baseado em web
        await this.execute(interaction, client);
    },

    async handleModal(interaction, client) {
        // Esta função não é mais necessária no novo sistema
        await interaction.reply({
            content: 'O sistema de whitelist foi atualizado. Por favor, use o comando /whitelist para acessar o novo sistema.',
            ephemeral: true
        });
    }
};
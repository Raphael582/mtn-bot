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

            // Gerar URL direta para o sistema web
            const whitelistUrl = `http://localhost:${whitelistServer.options.port}/auth/discord?returnUrl=/`;

            // Criar embed com o link
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📝 Sistema de Whitelist Metânia')
                .setDescription(`Olá ${interaction.user.username}! Clique no botão abaixo para acessar o formulário de whitelist.`)
                .addFields(
                    { name: '⚠️ Atenção', value: 'Você será redirecionado para fazer login com sua conta do Discord.' },
                    { name: '📋 Instruções', value: '1. Clique no botão para acessar o sistema\n2. Faça login com sua conta Discord\n3. Preencha todas as informações corretamente\n4. Envie o formulário e aguarde a aprovação' }
                )
                .setImage('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67c93051&is=67c7ded1&hm=a337ccc36d99cb5360371bfa81955bc8b14ddb78ed722cec120421d3460a8d34&=&format=webp&width=651&height=663')
                .setFooter({ text: 'Desenvolvido para Metânia por Mr.Dark' })
                .setTimestamp();

            // Botão para o link
            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Abrir Sistema de Whitelist')
                    .setStyle(ButtonStyle.Link)
                    .setURL(whitelistUrl)
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
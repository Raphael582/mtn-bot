// commands/whitelist.js
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
            const dbPath = path.join(__dirname, '..', 'database');
            const filePath = path.join(dbPath, 'usuarios.json');
            
            let registros = [];
            if (fs.existsSync(filePath)) {
                try {
                    registros = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                } catch (err) {
                    console.error('❌ Erro ao ler o arquivo JSON:', err);
                }
            }
            
            // Verificar se o usuário já tem uma solicitação pendente
            const temPendente = registros.some(registro => 
                registro.id_usuario === interaction.user.id && 
                registro.status === 'Pendente'
            );
            
            if (temPendente) {
                return await interaction.reply({
                    content: 'Você já possui uma solicitação de whitelist pendente. Por favor, aguarde a análise da equipe.',
                    ephemeral: true
                });
            }
            
            // Verificar se o usuário já foi aprovado
            const temAprovado = registros.some(registro => 
                registro.id_usuario === interaction.user.id && 
                registro.status === 'Aprovado'
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
    },

    async handleButtonApproval(interaction, client) {
        // Verificar se é um botão do sistema antigo
        const isOldSystem = !interaction.customId.startsWith('wl_');
        
        if (isOldSystem) {
            try {
                const customIdParts = interaction.customId.split('_');
                const action = customIdParts[0];
                const userId = interaction.message.embeds[0].footer.text.match(/\((\d+)\)/)?.[1];
                
                if (!userId) {
                    return await interaction.reply({
                        content: 'Não foi possível identificar o usuário desta solicitação.',
                        ephemeral: true
                    });
                }
                
                await interaction.deferReply({ ephemeral: true });
                
                // Obter dados do arquivo JSON
                const filePath = path.join(__dirname, '..', 'database', 'usuarios.json');
                let registros = [];
                
                if (fs.existsSync(filePath)) {
                    try {
                        registros = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    } catch (err) {
                        console.error('❌ Erro ao ler o arquivo JSON:', err);
                        return await interaction.editReply({
                            content: 'Erro ao processar a solicitação. Por favor, tente novamente.',
                            ephemeral: true
                        });
                    }
                }
                
                // Encontrar o registro do usuário
                const registroIndex = registros.findIndex(r => 
                    r.id_usuario === userId && r.status === 'Pendente'
                );
                
                if (registroIndex === -1) {
                    return await interaction.editReply({
                        content: 'Esta solicitação já foi processada ou não existe mais.',
                        ephemeral: true
                    });
                }
                
                // Atualizar status
                const aprovado = action === 'approve';
                registros[registroIndex].status = aprovado ? 'Aprovado' : 'Rejeitado';
                registros[registroIndex].aprovador = interaction.user.tag;
                registros[registroIndex].data_aprovacao = new Date().toISOString();
                
                // Salvar alterações
                fs.writeFileSync(filePath, JSON.stringify(registros, null, 4), 'utf-8');
                
                // Atualizar mensagem
                const originalMessage = await interaction.message.fetch();
                const embed = originalMessage.embeds[0];
                
                const updatedEmbed = EmbedBuilder.from(embed)
                    .setColor(aprovado ? '#00ff00' : '#ff0000')
                    .setTitle(`Whitelist ${aprovado ? '✅ Aprovada' : '❌ Rejeitada'}`)
                    .setFooter({ 
                        text: `${embed.footer.text} | Ação por: ${interaction.user.tag}` 
                    });
                
                await originalMessage.edit({ embeds: [updatedEmbed], components: [] });
                
                // Adicionar cargo se aprovado
                if (aprovado) {
                    try {
                        const member = await interaction.guild.members.fetch(userId);
                        const role = interaction.guild.roles.cache.find(r => r.name === 'Whitelisted');
                        
                        if (member && role) {
                            await member.roles.add(role);
                            console.log(`🏷️ Cargo Whitelisted adicionado para ${member.user.tag}`);
                        }
                    } catch (error) {
                        console.error(`❌ Erro ao adicionar cargo:`, error);
                    }
                }
                
                // Notificar o usuário
                try {
                    const user = await client.users.fetch(userId);
                    await user.send(`Sua solicitação de whitelist foi ${aprovado ? 'aprovada' : 'rejeitada'}! ${aprovado ? '🎉' : '😢'}`);
                } catch (error) {
                    console.error(`❌ Não foi possível enviar DM ao usuário:`, error);
                }
                
                // Confirmar para o moderador
                await interaction.editReply({
                    content: `Whitelist ${aprovado ? 'aprovada' : 'rejeitada'} com sucesso!`,
                    ephemeral: true
                });
                
            } catch (error) {
                console.error('❌ Erro ao processar aprovação/rejeição:', error);
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: 'Ocorreu um erro ao processar esta ação.',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: 'Ocorreu um erro ao processar esta ação.',
                        ephemeral: true
                    });
                }
            }
        } else {
            // Novo sistema - Tratado no evento interactionCreate do bot.js
            await interaction.deferUpdate();
        }
    },

    async handleModalRejection(interaction, client) {
        // Esta função é mantida apenas para compatibilidade com o sistema antigo
        await interaction.reply({
            content: 'O sistema de whitelist foi atualizado.',
            ephemeral: true
        });
    }
};
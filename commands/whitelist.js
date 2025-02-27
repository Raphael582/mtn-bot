const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Definir caminho correto para o arquivo de dados
const directoryPath = path.join(__dirname, '..', 'database');
const filePath = path.join(directoryPath, 'usuarios.json');

// Função para ler dados do JSON
function lerRegistrosWhitelist() {
    // Criar diretório se não existir
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Ler o arquivo se existir ou retornar array vazio
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (err) {
            console.error('❌ Erro ao ler o arquivo JSON:', err);
            return [];
        }
    }
    return [];
}

// Função para salvar no JSON
function salvarWhitelist(data) {
    const registros = lerRegistrosWhitelist();
    
    // Verificar se já existe um registro pendente para este usuário
    const usuarioIndex = registros.findIndex(
        registro => registro.id_usuario === data.id_usuario && registro.status === 'Pendente'
    );
    
    // Se estiver atualizando um registro existente (aprovação/rejeição)
    if (data.status === 'Aprovado' || data.status === 'Rejeitado') {
        // Encontrar o registro pendente correspondente
        const pendingIndex = registros.findIndex(
            registro => registro.id_usuario === data.id_usuario && registro.status === 'Pendente'
        );
        
        if (pendingIndex !== -1) {
            // Atualizar o registro existente em vez de adicionar um novo
            registros[pendingIndex] = {
                ...registros[pendingIndex],
                status: data.status,
                aprovador: data.aprovador,
                data_aprovacao: data.data
            };
        } else {
            // Se não encontrar um pendente, adiciona um novo (caso incomum)
            registros.push(data);
        }
    } else if (usuarioIndex !== -1) {
        // Se já existe um registro pendente, substitui pelo novo
        registros[usuarioIndex] = data;
    } else {
        // Caso contrário, adiciona um novo registro
        registros.push(data);
    }
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(registros, null, 4));
        console.log('✅ Registro de whitelist salvo com sucesso!');
    } catch (err) {
        console.error('❌ Erro ao salvar no arquivo JSON:', err);
    }
}

module.exports = {
    // Função para executar o comando de whitelist
    async execute(interaction, client) {
        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_whitelist')
                .setLabel('Iniciar Whitelist')
                .setStyle(ButtonStyle.Primary),
        );

        await interaction.reply({
            content: 'Clique no botão abaixo para iniciar o processo de whitelist.',
            components: [button],
        });
    },

    // Função para tratar o botão de whitelist
    async handleButton(interaction, client) {
        try {
            if (interaction.customId === 'start_whitelist') {
                const modal = new ModalBuilder()
                    .setCustomId('whitelist_modal')
                    .setTitle('Formulário de Whitelist');

                const questions = [
                    new TextInputBuilder()
                        .setCustomId('nome')
                        .setLabel('Qual é o seu nome?')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true),
                    new TextInputBuilder()
                        .setCustomId('idade')
                        .setLabel('Qual é a sua idade?')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true),
                    new TextInputBuilder()
                        .setCustomId('motivo')
                        .setLabel('Por que você quer entrar?')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true),
                ];

                const actionRows = questions.map(question =>
                    new ActionRowBuilder().addComponents(question)
                );

                modal.addComponents(...actionRows);

                await interaction.showModal(modal);
            }
        } catch (error) {
            console.error('❌ Erro no botão:', error);
            await interaction.reply({ content: 'Erro ao processar a ação.', ephemeral: true });
        }
    },

    // Função para tratar a submissão do modal
    async handleModal(interaction, client) {
        if (interaction.customId === 'whitelist_modal') {
            const nome = interaction.fields.getTextInputValue('nome');
            const idade = interaction.fields.getTextInputValue('idade');
            const motivo = interaction.fields.getTextInputValue('motivo');

            const logChannel = interaction.guild.channels.cache.find(channel => channel.name === 'logs-wl');

            // Verificando se o canal de logs existe
            if (!logChannel) {
                console.error('❌ Canal "logs-wl" não encontrado!');
                return await interaction.reply({ 
                    content: '❌ Canal de logs não encontrado. Por favor, crie um canal chamado "logs-wl".', 
                    ephemeral: true 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('Nova Solicitação de Whitelist')
                .addFields(
                    { name: 'Nome', value: nome },
                    { name: 'Idade', value: idade },
                    { name: 'Motivo', value: motivo }
                )
                .setFooter({ text: `Solicitante: ${interaction.user.tag} (${interaction.user.id})` })
                .setColor(0x3498db)
                .setTimestamp();

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('approve_whitelist').setLabel('Aprovar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('reject_whitelist').setLabel('Rejeitar').setStyle(ButtonStyle.Danger),
            );

            try {
                await logChannel.send({ embeds: [embed], components: [buttons] });
                console.log('✅ Solicitação de whitelist enviada para o canal de logs!');
            } catch (error) {
                console.error('❌ Erro ao enviar a solicitação de whitelist para o canal de logs:', error);
                return await interaction.reply({ 
                    content: '❌ Erro ao enviar para o canal de logs.', 
                    ephemeral: true 
                });
            }

            // Enviar confirmação para o usuário
            await interaction.reply({ 
                content: '✅ Seu formulário foi enviado para análise! Aguarde o contato da equipe.', 
                ephemeral: true 
            });

            // Salvar no arquivo JSON
            salvarWhitelist({
                id_usuario: interaction.user.id,
                nome_usuario: nome,
                idade: idade,
                motivo: motivo,
                status: 'Pendente',
                data: new Date().toISOString(),
            });
        }
    },

    // Função para lidar com aprovação ou rejeição
    async handleButtonApproval(interaction, client) {
        if (interaction.customId === 'approve_whitelist' || interaction.customId === 'reject_whitelist') {
            try {
                await interaction.deferReply({ ephemeral: true });
                
                const originalMessage = await interaction.message.fetch();
                const embed = originalMessage.embeds[0];

                if (!embed) {
                    return await interaction.editReply({ content: 'Erro: Embed não encontrada.' });
                }

                const aprovado = interaction.customId === 'approve_whitelist';
                const status = aprovado ? '✅ Aprovado' : '❌ Rejeitado';
                const cor = aprovado ? 0x00ff00 : 0xff0000;

                const updatedEmbed = EmbedBuilder.from(embed)
                    .setColor(cor)
                    .setTitle(`Whitelist ${status}`)
                    .setFooter({ 
                        text: `${embed.footer.text} | Ação por: ${interaction.user.tag}` 
                    });

                await originalMessage.edit({ embeds: [updatedEmbed], components: [] });

                await interaction.editReply({ content: `Whitelist ${status.toLowerCase()} com sucesso!`, ephemeral: true });

                // Extrair o ID do usuário do footer da embed
                const match = embed.footer?.text?.match(/\((\d+)\)/);
                const userId = match ? match[1] : null;

                if (userId) {
                    let member;
                    try {
                        member = await interaction.guild.members.fetch(userId);
                    } catch (err) {
                        console.error('❌ Erro ao buscar membro:', err);
                        member = null;
                    }

                    if (member) {
                        // Enviar mensagem no canal mencionando o usuário
                        try {
                            await interaction.channel.send(`${member} sua whitelist foi ${status.toLowerCase()}! ${aprovado ? '🎉' : '😢'}`);
                        } catch (error) {
                            console.error('❌ Erro ao enviar mensagem no canal:', error);
                        }

                        // Tentar enviar mensagem direta
                        try {
                            await member.send(`Sua solicitação de whitelist foi ${status.toLowerCase()}! ${aprovado ? 'Parabéns! 🎉' : 'Tente novamente em breve!'}`);
                        } catch (error) {
                            console.error('❌ Não foi possível enviar mensagem direta para o usuário:', error);
                            // Notificar no canal que não foi possível enviar DM
                            try {
                                await interaction.channel.send(
                                    `Não foi possível enviar uma mensagem direta para ${member}. Certifique-se que o usuário tenha DMs abertas.`
                                );
                            } catch(err) {
                                console.error('❌ Erro ao enviar mensagem de fallback no canal:', err);
                            }
                        }
                    } else {
                        console.error('❌ Membro não encontrado no servidor.');
                    }

                    // Obter dados do embed
                    try {
                        const nomeValue = embed.fields?.find(f => f.name === 'Nome')?.value || 'Não disponível';
                        const idadeValue = embed.fields?.find(f => f.name === 'Idade')?.value || 'Não disponível';
                        const motivoValue = embed.fields?.find(f => f.name === 'Motivo')?.value || 'Não disponível';

                        // Salvar dados atualizados no JSON
                        salvarWhitelist({
                            id_usuario: userId,
                            nome_usuario: nomeValue,
                            idade: idadeValue,
                            motivo: motivoValue,
                            status: aprovado ? 'Aprovado' : 'Rejeitado',
                            aprovador: interaction.user.tag,
                            data: new Date().toISOString(),
                        });
                    } catch (error) {
                        console.error('❌ Erro ao extrair ou salvar dados:', error);
                    }
                } else {
                    console.error('❌ Não foi possível extrair o ID do usuário do embed.');
                }
            } catch (error) {
                console.error('❌ Erro ao processar aprovação/rejeição:', error);
                try {
                    if (interaction.deferred) {
                        await interaction.editReply({ 
                            content: '❌ Ocorreu um erro ao processar esta ação.', 
                            ephemeral: true 
                        });
                    } else {
                        await interaction.reply({ 
                            content: '❌ Ocorreu um erro ao processar esta ação.', 
                            ephemeral: true 
                        });
                    }
                } catch (err) {
                    console.error('❌ Erro ao responder após falha:', err);
                }
            }
        }
    }
};
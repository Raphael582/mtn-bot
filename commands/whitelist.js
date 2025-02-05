const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'database', 'usuarios.json');  // Alterando para salvar no novo caminho

// Função para salvar no JSON
function salvarWhitelist(data) {
    let registros = [];

    // Criar diretório se não existir
    const directoryPath = path.join(__dirname, '..', 'database');
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
        try {
            registros = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (err) {
            console.error('Erro ao ler o arquivo JSON:', err);
        }
    }

    // Adicionar o novo registro e salvar
    registros.push(data);
    try {
        fs.writeFileSync(filePath, JSON.stringify(registros, null, 4));
        console.log('✅ Registro de whitelist salvo com sucesso!');
    } catch (err) {
        console.error('Erro ao salvar no arquivo JSON:', err);
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
                        .setStyle(TextInputStyle.Short),
                    new TextInputBuilder()
                        .setCustomId('idade')
                        .setLabel('Qual é a sua idade?')
                        .setStyle(TextInputStyle.Short),
                    new TextInputBuilder()
                        .setCustomId('motivo')
                        .setLabel('Por que você quer entrar?')
                        .setStyle(TextInputStyle.Paragraph),
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
                return await interaction.reply({ content: '❌ Canal de logs não encontrado.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('Nova Solicitação de Whitelist')
                .addFields(
                    { name: 'Nome', value: nome },
                    { name: 'Idade', value: idade },
                    { name: 'Motivo', value: motivo }
                )
                .setFooter({ text: `Solicitante: ${interaction.user.tag} (${interaction.user.id})` })
                .setColor(0x3498db);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('approve_whitelist').setLabel('Aprovar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('reject_whitelist').setLabel('Rejeitar').setStyle(ButtonStyle.Danger),
            );

            try {
                await logChannel.send({ embeds: [embed], components: [buttons] });
                console.log('✅ Solicitação de whitelist enviada para o canal de logs!');
            } catch (error) {
                console.error('❌ Erro ao enviar a solicitação de whitelist para o canal de logs:', error);
                await interaction.reply({ content: '❌ Erro ao enviar para o canal de logs.', ephemeral: true });
            }

            // Enviar confirmação para o usuário
            await interaction.reply({ content: '✅ Seu formulário foi enviado para análise!', ephemeral: true });

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
            await interaction.deferReply({ ephemeral: true });

            const originalMessage = await interaction.message.fetch();
            const embed = originalMessage.embeds[0];

            if (!embed) {
                return await interaction.editReply({ content: 'Erro: Embed não encontrada.' });
            }

            const aprovado = interaction.customId === 'approve_whitelist';
            const status = aprovado ? '✅ Aprovado' : '❌ Rejeitado';
            const cor = aprovado ? 0x00ff00 : 0xff0000;

            const updatedEmbed = new EmbedBuilder(embed)
                .setColor(cor)
                .setTitle(`Whitelist ${status}`)
                .setFooter({ text: `Aprovado por: ${interaction.user.tag}` });

            await originalMessage.edit({ embeds: [updatedEmbed], components: [] });

            await interaction.editReply({ content: `Whitelist ${status} com sucesso!`, ephemeral: true });

            // Enviar mensagem no canal mencionando o usuário
            const userId = embed.footer.text.match(/\d{18}/)?.[0];
            const member = interaction.guild.members.cache.get(userId);

            if (member) {
                await interaction.channel.send(`${member} sua whitelist foi ${status.toLowerCase()}! 🎉`);
            }

            // Enviar confirmação para o usuário que fez o pedido (interação direta)
            await interaction.user.send(`Sua solicitação de whitelist foi ${status.toLowerCase()}! ${status === '✅ Aprovado' ? 'Parabéns! 🎉' : 'Tente novamente em breve!'} `);

            // Salvar no JSON
            salvarWhitelist({
                id_usuario: userId,
                nome_usuario: embed.fields[0].value,
                idade: embed.fields[1].value,
                motivo: embed.fields[2].value,
                status: aprovado ? 'Aprovado' : 'Rejeitado',
                aprovador: interaction.user.tag,
                data: new Date().toISOString(),
            });
        }
    }
};

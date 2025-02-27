// commands/managewhitelist.js - Com perguntas sincronizadas com o whitelist.js original
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Definição do comando - Usando um nome diferente para evitar conflito
const data = new SlashCommandBuilder()
    .setName('wlnew')
    .setDescription('🚀 Sistema de whitelist alternativo');

// Funções para leitura e escrita de dados
function readWhitelistData(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            // Criar diretório se não existir
            const dirPath = path.dirname(filePath);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            fs.writeFileSync(filePath, '[]', 'utf8');
            return [];
        }

        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ Erro ao ler dados de whitelist: ${error}`);
        return [];
    }
}

function writeWhitelistData(filePath, data) {
    try {
        // Criar diretório se não existir
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error(`❌ Erro ao escrever dados de whitelist: ${error}`);
        return false;
    }
}

/**
 * Executa o comando /wlnew.
 * @param {import('discord.js').CommandInteraction} interaction A interação do comando.
 * @param {import('discord.js').Client} client O cliente Discord.
 */
async function execute(interaction, client) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('whitelist_modal_new')
            .setTitle('📝 Formulário de Whitelist');

        // SINCRONIZADO: Usando as mesmas perguntas do whitelist.js original
        const nomeInput = new TextInputBuilder()
            .setCustomId('nome')
            .setLabel('Qual é o seu nome?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Digite seu nome ou apelido');

        const idadeInput = new TextInputBuilder()
            .setCustomId('idade')
            .setLabel('Qual é a sua idade?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Digite sua idade em números');

        const motivoInput = new TextInputBuilder()
            .setCustomId('motivo')
            .setLabel('Por que você quer entrar?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Descreva seus motivos para entrar no servidor');

        // Action Rows
        const firstActionRow = new ActionRowBuilder().addComponents(nomeInput);
        const secondActionRow = new ActionRowBuilder().addComponents(idadeInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(motivoInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        await interaction.showModal(modal);
        console.log(`✅ Modal de whitelist mostrado para ${interaction.user.tag}`);

    } catch (error) {
        console.error(`❌ Erro no comando 'wlnew': ${error}`);
        await interaction.reply({ content: '❌ Erro ao iniciar whitelist.', ephemeral: true });
    }
}

/**
 * Lida com o clique no botão de iniciar whitelist.
 * @param {import('discord.js').ButtonInteraction} interaction A interação do botão.
 * @param {import('discord.js').Client} client O cliente Discord.
 */
async function handleButton(interaction, client) {
    await execute(interaction, client);
}

/**
 * Lida com o envio do modal de whitelist.
 * @param {import('discord.js').ModalSubmitInteraction} interaction A interação do modal.
 * @param {import('discord.js').Client} client O cliente Discord.
 */
async function handleModal(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    console.log(`📝 Processando envio do modal de whitelist por ${interaction.user.tag}`);

    // Config
    const config = {
        logChannelWhitelistName: 'logs-wl',
        accessRoleName: 'Whitelisted',
        welcomeMessage: 'Seja bem-vindo ao servidor!'
    };

    // Caminho para o arquivo de dados
    const filePath = path.join(__dirname, '..', 'database', 'usuarios.json');

    try {
        // SINCRONIZADO: Extrair respostas usando os mesmos IDs do whitelist.js original
        const nome = interaction.fields.getTextInputValue('nome');
        const idade = interaction.fields.getTextInputValue('idade');
        const motivo = interaction.fields.getTextInputValue('motivo');

        const idUsuario = interaction.user.id;
        const nomeUsuarioDiscord = interaction.user.tag;

        // Validação básica dos dados
        if (nome.length < 2 || nome.length > 50) {
            return await interaction.editReply({ content: '❌ Nome inválido. Use entre 2 e 50 caracteres.', ephemeral: true });
        }
        
        const idadeNum = parseInt(idade);
        if (isNaN(idadeNum) || idadeNum < 10 || idadeNum > 100) {
            return await interaction.editReply({ content: "❌ Idade inválida. Insira um número entre 10 e 100.", ephemeral: true });
        }

        const registrosWhitelist = readWhitelistData(filePath);

        // Checagem de duplicados
        const usuarioDuplicado = registrosWhitelist.find(reg => reg.id_usuario === idUsuario && reg.status === 'Pendente');
        if (usuarioDuplicado) {
            return await interaction.editReply({ content: '⚠️ Você já submeteu a whitelist antes. Aguarde a análise.', ephemeral: true });
        }

        // SINCRONIZADO: Usando a mesma estrutura de dados do whitelist.js original
        const registroWhitelist = {
            id_usuario: idUsuario,
            nome_usuario: nome,
            idade: idade,
            motivo: motivo,
            status: 'Pendente',
            data: new Date().toISOString(),
        };

        registrosWhitelist.push(registroWhitelist);
        writeWhitelistData(filePath, registrosWhitelist);
        console.log(`📝 Whitelist salva para ${nomeUsuarioDiscord}`);

        const logChannel = interaction.guild.channels.cache.find(channel => channel.name === config.logChannelWhitelistName);
        if (!logChannel) {
            console.error(`❌ Canal de logs '${config.logChannelWhitelistName}' não encontrado`);
            return await interaction.editReply({ content: `⚠️ Whitelist submetida, mas canal de logs '${config.logChannelWhitelistName}' não encontrado.`, ephemeral: true });
        }

        const approveButton = new ButtonBuilder()
            .setCustomId(`approve_whitelist_${idUsuario}`)
            .setLabel('✅ Aprovar')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId(`reject_whitelist_${idUsuario}`)
            .setLabel('❌ Rejeitar')
            .setStyle(ButtonStyle.Danger);

        const buttonRow = new ActionRowBuilder().addComponents(approveButton, rejectButton);

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('Nova Solicitação de Whitelist')
            .setFooter({ text: `Solicitante: ${interaction.user.tag} (${interaction.user.id})` })
            .addFields(
                { name: 'Nome', value: nome },
                { name: 'Idade', value: idade },
                { name: 'Motivo', value: motivo }
            )
            .setTimestamp();

        try {
            await logChannel.send({ embeds: [embed], components: [buttonRow] });
            console.log(`📨 Embed enviado para o canal ${config.logChannelWhitelistName}`);
            await interaction.editReply({ content: '✅ Seu formulário foi enviado para análise!', ephemeral: true });
        } catch (error) {
            console.error(`❌ Erro ao enviar mensagem para canal de logs: ${error}`);
            await interaction.editReply({ content: '✅ Whitelist submetida, mas erro ao enviar para o canal de logs.', ephemeral: true });
        }
    } catch (error) {
        console.error(`❌ Erro ao processar modal de whitelist: ${error}`);
        await interaction.editReply({ content: '❌ Ocorreu um erro ao processar seu formulário.', ephemeral: true });
    }
}

/**
 * Lida com os botões de aprovação e rejeição da whitelist.
 * @param {import('discord.js').ButtonInteraction} interaction A interação do botão.
 * @param {import('discord.js').Client} client O cliente Discord.
 */
async function handleButtonApproval(interaction, client) {
    console.log(`👆 Botão de aprovação/rejeição clicado por ${interaction.user.tag}`);
    
    const customIdParts = interaction.customId.split('_');
    const action = customIdParts[0];
    const userIdToWhitelist = customIdParts[2];

    // Config
    const config = {
        logChannelWhitelistName: 'logs-wl',
        accessRoleName: 'Whitelisted',
        welcomeMessage: 'Seja bem-vindo ao servidor!'
    };

    // Caminho para o arquivo de dados - SINCRONIZADO com o whitelist.js original
    const filePath = path.join(__dirname, '..', 'database', 'usuarios.json');

    const registrosWhitelist = readWhitelistData(filePath);
    const registroAlvoIndex = registrosWhitelist.findIndex(registro => registro.id_usuario === userIdToWhitelist && registro.status === 'Pendente');

    if (registroAlvoIndex === -1) {
        await interaction.reply({ content: '⚠️ Registro de whitelist não encontrado ou já processado.', ephemeral: true });
        return;
    }
    const registroAlvo = registrosWhitelist[registroAlvoIndex];

    const guild = interaction.guild;
    let member;
    try {
        member = await guild.members.fetch(userIdToWhitelist);
    } catch (error) {
        console.error(`❌ Erro ao buscar membro: ${error}`);
        member = null;
    }
    
    const role = guild.roles.cache.find(role => role.name === config.accessRoleName);
    const logChannel = guild.channels.cache.find(channel => channel.name === config.logChannelWhitelistName);

    if (!role) {
        console.error(`❌ Cargo '${config.accessRoleName}' não encontrado`);
    }
    
    if (!logChannel) {
        console.error(`❌ Canal '${config.logChannelWhitelistName}' não encontrado`);
    }

    if (action === 'approve') {
        await interaction.deferReply({ ephemeral: true });
        await approveWhitelistEntry(registroAlvo, interaction, client, config, registrosWhitelist, role, member, logChannel, filePath, registroAlvoIndex);
    } else if (action === 'reject') {
        await interaction.deferReply({ ephemeral: true });
        await rejectWhitelistEntry(registroAlvo, interaction, client, config, registrosWhitelist, logChannel, filePath, registroAlvoIndex);
    }
}

/**
 * Aprova uma entrada de whitelist.
 * @param {object} registroAlvo O registro da whitelist a ser aprovado.
 * @param {import('discord.js').ButtonInteraction} interaction A interação do botão.
 * @param {import('discord.js').Client} client O cliente Discord.
 * @param {object} config Configurações do bot.
 * @param {Array} registrosWhitelist Array com todos os registros.
 * @param {import('discord.js').Role} role O cargo a ser atribuído.
 * @param {import('discord.js').GuildMember} member O membro a receber o cargo.
 * @param {import('discord.js').TextChannel} logChannel O canal de logs.
 * @param {string} filePath Caminho para o arquivo de dados.
 * @param {number} registroAlvoIndex Índice do registro no array.
 */
async function approveWhitelistEntry(registroAlvo, interaction, client, config, registrosWhitelist, role, member, logChannel, filePath, registroAlvoIndex) {
    // SINCRONIZADO com o formato do whitelist.js original
    registroAlvo.status = 'Aprovado';
    registroAlvo.aprovador = interaction.user.tag;
    registroAlvo.data = new Date().toISOString();

    if (member && role) {
        try {
            await member.roles.add(role);
            console.log(`🏷️ Cargo ${config.accessRoleName} adicionado a ${member.user.tag}`);
        } catch (roleError) {
            console.error(`❌ Erro ao atribuir cargo ${config.accessRoleName}: ${roleError}`);
            await interaction.editReply({ content: `❌ Erro ao atribuir cargo ${config.accessRoleName}.`, components: [] });
            return;
        }
    } else {
        console.warn(`⚠️ Membro ou cargo '${config.accessRoleName}' não encontrados.`);
        if (!member) {
            console.warn(`⚠️ Membro ${registroAlvo.id_usuario} não está mais no servidor`);
        }
        await interaction.editReply({ content: `⚠️ Membro ou cargo '${config.accessRoleName}' não encontrados.`, components: [] });
        return;
    }

    // Atualiza a mensagem original
    const originalMessage = await interaction.message.fetch();
    const embed = originalMessage.embeds[0];

    const updatedEmbed = EmbedBuilder.from(embed)
        .setColor('#00ff00')
        .setTitle(`Whitelist ✅ Aprovado`)
        .setFooter({ text: `${embed.footer.text} | Aprovado por: ${interaction.user.tag}` });

    await originalMessage.edit({ embeds: [updatedEmbed], components: [] });

    // Envia mensagem no canal
    try {
        await interaction.channel.send(`${member} sua whitelist foi aprovada! 🎉`);
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem no canal: ${error}`);
    }

    // Envia DM para o usuário
    try {
        const userDM = await client.users.fetch(registroAlvo.id_usuario);
        if (userDM) {
            await userDM.send(`Sua solicitação de whitelist foi aprovada! Parabéns! 🎉`).catch(error => {
                console.error(`❌ Não foi possível enviar DM ao usuário: ${error}`);
            });
            console.log(`📨 DM de aprovação enviada para ${registroAlvo.nome_usuario}`);
        }
    } catch (error) {
        console.error(`❌ Erro ao enviar DM de aprovação: ${error}`);
    }

    writeWhitelistData(filePath, registrosWhitelist);
    await interaction.editReply({ content: `Whitelist ✅ APROVADA ✅ para <@${registroAlvo.id_usuario}>.`, components: [] });
}

/**
 * Rejeita uma entrada de whitelist.
 * @param {object} registroAlvo O registro de whitelist a ser rejeitado.
 * @param {import('discord.js').ButtonInteraction} interaction A interação do botão.
 * @param {import('discord.js').Client} client O cliente Discord.
 * @param {object} config Configurações do bot.
 * @param {Array} registrosWhitelist Array com todos os registros.
 * @param {import('discord.js').TextChannel} logChannel O canal de logs.
 * @param {string} filePath Caminho para o arquivo de dados.
 * @param {number} registroAlvoIndex Índice do registro no array.
 */
async function rejectWhitelistEntry(registroAlvo, interaction, client, config, registrosWhitelist, logChannel, filePath, registroAlvoIndex) {
    // SINCRONIZADO com o formato do whitelist.js original
    registroAlvo.status = 'Rejeitado';
    registroAlvo.aprovador = interaction.user.tag;
    registroAlvo.data = new Date().toISOString();

    // Atualiza a mensagem original
    const originalMessage = await interaction.message.fetch();
    const embed = originalMessage.embeds[0];

    const updatedEmbed = EmbedBuilder.from(embed)
        .setColor('#ff0000')
        .setTitle(`Whitelist ❌ Rejeitado`)
        .setFooter({ text: `${embed.footer.text} | Rejeitado por: ${interaction.user.tag}` });

    await originalMessage.edit({ embeds: [updatedEmbed], components: [] });

    // Envia mensagem no canal
    try {
        const userId = registroAlvo.id_usuario;
        await interaction.channel.send(`<@${userId}> sua whitelist foi rejeitada! 😢`);
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem no canal: ${error}`);
    }

    // Envia DM para o usuário
    try {
        const userDM = await client.users.fetch(registroAlvo.id_usuario);
        if (userDM) {
            await userDM.send(`Sua solicitação de whitelist foi rejeitada! Tente novamente em breve!`).catch(error => {
                console.error(`❌ Não foi possível enviar DM ao usuário: ${error}`);
            });
            console.log(`📨 DM de rejeição enviada para ${registroAlvo.nome_usuario}`);
        }
    } catch (error) {
        console.error(`❌ Erro ao enviar DM de rejeição: ${error}`);
    }
    
    writeWhitelistData(filePath, registrosWhitelist);
    await interaction.editReply({ content: `Whitelist ❌ REJEITADA ❌ para <@${registroAlvo.id_usuario}>.`, components: [] });
}

module.exports = {
    data,
    execute,
    handleButton,
    handleModal,
    handleButtonApproval
};
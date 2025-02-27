// commands/nuke.js - VERSÃO FINAL - ES MODULES (IMPORTS) - COMANDO NUKE - PERMISSIONAMENTO OK - ESTILO REFEITO (EMBEDS ENFEITADOS)

import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('🔥 Limpa o canal atual apagando as mensagens. (Requer permissão de Gerenciar Canais)') // 🔥 Emoji no comando nuke
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels) // Permissão de "Gerenciar Canais"
    .setDMPermission(false); // Não pode ser usado em DMs


export async function execute(interaction) {
    if (!interaction.channel.isTextBased() || interaction.channel.type === ChannelType.DM) {
        return await interaction.reply({ content: 'Este comando só pode ser usado em canais de texto em servidores, não em DMs.', ephemeral: true });
    }

    const channel = interaction.channel;

    try {
        await interaction.deferReply({ ephemeral: true }); // Resposta inicial DEFERIDA, para demorar mais que 3 segundos

        const position = channel.position;
        const newChannel = await channel.clone(); // Clona o canal
        await channel.delete(); // Apaga o canal antigo

        newChannel.setPosition(position); // Garante que o novo canal fica na mesma posição
        await newChannel.send('🔥 Canal limpo com sucesso! 🔥'); // Mensagem no novo canal

        const embedLogNuke = new EmbedBuilder() // Embed para LOG no canal atual (opcionalmente, pode ter um canal de logs separado)
            .setColor('#ff0000') // Vermelho para "perigo/alerta"
            .setTitle('🔥 Canal NUKADO! 🔥')
            .setDescription(`O canal <#${newChannel.id}> foi limpo por ${interaction.user.tag} (ID: ${interaction.user.id}).`)
            .addFields(
                { name: '👮‍♂️ Mod Responsável', value: `${interaction.user.tag} (ID: ${interaction.user.id})`, inline: true },
                { name: '💥 Canal Nukado', value: `<#${newChannel.id}>`, inline: true }
            )
            .setTimestamp();

        await newChannel.send({ embeds: [embedLogNuke] }); // Envia o embed de LOG no *novo* canal


        await interaction.editReply({ content: 'Canal limpo com sucesso! 🔥', ephemeral: true }); // Edita a resposta diferida para feedback final (ephemeral)


    } catch (error) {
        console.error("❌ Erro ao nukar o canal:", error);
        await interaction.editReply({ content: '❌ Falha ao limpar o canal.', ephemeral: true }); // Edita a resposta diferida em caso de erro (ephemeral)
    }
}
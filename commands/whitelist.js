const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Acesse o formulário de whitelist ou verifique seu status')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Verifique o status da sua solicitação de whitelist')),

    async execute(interaction) {
        try {
            console.log('📝 Comando whitelist executado');
            console.log('🌐 URL do whitelist:', process.env.WHITELIST_URL);
            
            // Verificar se é um subcomando
            const subcommand = interaction.options.getSubcommand();
            console.log('📋 Subcomando:', subcommand || 'nenhum (formulário)');

            if (subcommand === 'status') {
                try {
                    console.log('🔍 Verificando status...');
                    const response = await fetch(`${process.env.WHITELIST_URL}/api/whitelist/forms`);
                    console.log('📡 Resposta do servidor:', response.status);
                    
                    if (!response.ok) {
                        throw new Error(`Erro na resposta do servidor: ${response.status}`);
                    }
                    
                    const forms = await response.json();
                    console.log('📊 Total de formulários:', forms.length);
                    
                    const userForm = forms.find(f => f.nome === interaction.user.username);
                    console.log('👤 Formulário do usuário:', userForm ? 'encontrado' : 'não encontrado');
                    
                    if (!userForm) {
                        return interaction.reply({
                            content: 'Você ainda não enviou uma solicitação de whitelist.',
                            ephemeral: true
                        });
                    }

                    const statusEmbed = new EmbedBuilder()
                        .setColor('#3498db')
                        .setTitle('📝 Status da Whitelist')
                        .setDescription(`Status da sua solicitação: **${userForm.status.toUpperCase()}**`)
                        .addFields(
                            { name: 'Data de Envio', value: new Date(userForm.dataEnvio).toLocaleDateString('pt-BR'), inline: true },
                            { name: 'Estado', value: userForm.estado, inline: true },
                            { name: 'Idade', value: userForm.idade, inline: true }
                        )
                        .setTimestamp();

                    if (userForm.status === 'rejeitado') {
                        statusEmbed.addFields({ name: 'Motivo da Rejeição', value: userForm.motivoRejeicao });
                    }

                    return interaction.reply({ embeds: [statusEmbed], ephemeral: true });
                } catch (error) {
                    console.error('❌ Erro ao verificar status:', error);
                    return interaction.reply({
                        content: 'Ocorreu um erro ao verificar o status da sua solicitação. Por favor, tente novamente mais tarde.',
                        ephemeral: true
                    });
                }
            } else {
                // Gerar link único para o usuário
                const userId = interaction.user.id;
                const formUrl = `${process.env.WHITELIST_URL}/form/${userId}`;

                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('📝 Formulário de Whitelist')
                    .setDescription(`Olá ${interaction.user}! Clique no botão abaixo para acessar seu formulário personalizado.`)
                    .addFields(
                        { name: '💡 Dica', value: 'Use o mesmo nome do seu Discord para facilitar a identificação.' },
                        { name: '⚠️ Importante', value: 'Você só poderá enviar um formulário. Se precisar alterar algo, entre em contato com a equipe.' }
                    )
                    .setImage('https://media.discordapp.net/attachments/1336750555359350874/1342183794379325523/Screenshot_2025-02-20-11-50-24-142-edit_com.whatsapp.jpg?ex=67c93051&is=67c7ded1&hm=a337ccc36d99cb5360371bfa81955bc8b14ddb78ed722cec120421d3460a8d34&=&format=webp&width=651&height=663')
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Acessar Formulário')
                            .setStyle(ButtonStyle.Primary)
                            .setURL(formUrl)
                    );

                await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('❌ Erro no comando whitelist:', error);
            console.error('Stack trace:', error.stack);
            await interaction.reply({
                content: 'Ocorreu um erro ao executar este comando. Por favor, tente novamente.',
                ephemeral: true
            });
        }
    }
};
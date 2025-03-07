const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Logger = require('../modules/logger');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Comandos de logs')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Visualiza logs do sistema')
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de log para visualizar')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Filtro', value: 'filter' },
                            { name: 'Punições', value: 'punish' },
                            { name: 'Whitelist', value: 'whitelist' },
                            { name: 'Erros', value: 'error' }
                        ))
                .addIntegerOption(option =>
                    option.setName('quantidade')
                        .setDescription('Quantidade de logs para mostrar')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('exportar')
                .setDescription('Exporta logs para arquivo CSV')
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de log para exportar')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Filtro', value: 'filter' },
                            { name: 'Punições', value: 'punish' },
                            { name: 'Whitelist', value: 'whitelist' },
                            { name: 'Erros', value: 'error' }
                        ))),

    async execute(interaction) {
        const logger = new Logger(interaction.client);
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'ver':
                    await handleView(interaction, logger);
                    break;
                case 'exportar':
                    await handleExport(interaction, logger);
                    break;
            }
        } catch (error) {
            console.error('Erro ao executar comando de logs:', error);
            await interaction.reply({
                content: 'Ocorreu um erro ao executar o comando.',
                ephemeral: true
            });
        }
    }
};

async function handleView(interaction, logger) {
    const type = interaction.options.getString('tipo');
    const amount = interaction.options.getInteger('quantidade') || 10;

    await interaction.deferReply({ ephemeral: true });

    try {
        const logs = await getLogs(type, amount);
        
        if (logs.length === 0) {
            await interaction.editReply({
                content: 'Nenhum log encontrado.',
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(getLogColor(type))
            .setTitle(`📊 Logs de ${getLogTitle(type)}`)
            .setDescription(`Mostrando os últimos ${amount} logs`)
            .setTimestamp();

        for (const log of logs) {
            const fields = [];
            
            // Adicionar campos comuns
            if (log.fields) {
                fields.push(...log.fields);
            }

            // Adicionar timestamp
            fields.push({
                name: 'Data/Hora',
                value: new Date(log.timestamp).toLocaleString('pt-BR'),
                inline: false
            });

            embed.addFields(fields);
        }

        await interaction.editReply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        await interaction.editReply({
            content: 'Ocorreu um erro ao buscar os logs.',
            ephemeral: true
        });
    }
}

async function handleExport(interaction, logger) {
    const type = interaction.options.getString('tipo');

    await interaction.deferReply({ ephemeral: true });

    try {
        const logs = await getLogs(type);
        
        if (logs.length === 0) {
            await interaction.editReply({
                content: 'Nenhum log encontrado para exportar.',
                ephemeral: true
            });
            return;
        }

        // Criar diretório de exportação se não existir
        const exportDir = path.join(__dirname, '..', 'exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        // Gerar nome do arquivo
        const date = new Date();
        const fileName = `${type}_logs_${date.toISOString().split('T')[0]}.csv`;
        const filePath = path.join(exportDir, fileName);

        // Criar conteúdo CSV
        const headers = ['timestamp', 'title', 'description'];
        let csvContent = headers.join(',') + '\n';

        for (const log of logs) {
            const row = [
                new Date(log.timestamp).toLocaleString('pt-BR'),
                log.title,
                log.description
            ].map(value => `"${value}"`).join(',');
            
            csvContent += row + '\n';
        }

        // Salvar arquivo
        fs.writeFileSync(filePath, csvContent, 'utf8');

        // Enviar arquivo
        await interaction.editReply({
            content: `✅ Logs exportados com sucesso!\nArquivo: ${fileName}`,
            files: [filePath],
            ephemeral: true
        });
    } catch (error) {
        await interaction.editReply({
            content: 'Ocorreu um erro ao exportar os logs.',
            ephemeral: true
        });
    }
}

async function getLogs(type, amount = 10) {
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
        return [];
    }

    const logFiles = fs.readdirSync(logsDir)
        .filter(file => file.startsWith(`${type}_`) && file.endsWith('.json'));

    let allLogs = [];

    for (const file of logFiles) {
        try {
            const fileContent = fs.readFileSync(path.join(logsDir, file), 'utf8');
            const logs = JSON.parse(fileContent);
            allLogs = allLogs.concat(logs);
        } catch (error) {
            console.error(`Erro ao ler arquivo de logs ${file}:`, error);
        }
    }

    // Ordenar por data mais recente e limitar quantidade
    return allLogs
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, amount);
}

function getLogColor(type) {
    const colors = {
        filter: 0x9B59B6,
        punish: 0xE67E22,
        whitelist: 0x1ABC9C,
        error: 0xE74C3C
    };
    return colors[type] || 0x3498DB;
}

function getLogTitle(type) {
    const titles = {
        filter: 'Filtro',
        punish: 'Punições',
        whitelist: 'Whitelist',
        error: 'Erros'
    };
    return titles[type] || 'Sistema';
} 
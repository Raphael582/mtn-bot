const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Constantes para formato de log
const LOG_LEVELS = {
    INFO: { color: 0x3498db, emoji: 'ℹ️', label: 'INFO' },
    SUCCESS: { color: 0x2ecc71, emoji: '✅', label: 'SUCESSO' },
    WARNING: { color: 0xf39c12, emoji: '⚠️', label: 'AVISO' },
    ERROR: { color: 0xe74c3c, emoji: '❌', label: 'ERRO' },
    FILTER: { color: 0x9b59b6, emoji: '🔍', label: 'FILTRO' },
    PUNISH: { color: 0xe67e22, emoji: '🚫', label: 'PUNIÇÃO' },
    WHITELIST: { color: 0x1abc9c, emoji: '📝', label: 'WHITELIST' }
};

/**
 * Gera um ID único para cada entrada de log
 * @returns {string} ID único baseado em timestamp
 */
function generateLogId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `LOG${timestamp}${random}`;
}

/**
 * Salva logs em arquivo
 * @param {string} type Tipo de log (filtro, punição, whitelist)
 * @param {object} data Dados do log
 */
function saveLogToFile(type, data) {
    const logsDir = path.join(__dirname, '..', 'logs');
    
    // Criar diretório se não existir
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Determinar arquivo de log baseado no tipo
    const date = new Date();
    const month = date.toLocaleString('default', { month: '2-digit' });
    const year = date.getFullYear();
    const logFile = path.join(logsDir, `${type}_${year}_${month}.json`);
    
    // Adicionar timestamp e ID
    const logEntry = {
        ...data,
        id: generateLogId(),
        timestamp: new Date().toISOString()
    };
    
    // Carregar logs existentes ou criar um novo array
    let logs = [];
    if (fs.existsSync(logFile)) {
        try {
            const fileContent = fs.readFileSync(logFile, 'utf8');
            logs = JSON.parse(fileContent);
        } catch (error) {
            console.error(`Erro ao ler arquivo de logs: ${error}`);
            // Criar backup do arquivo corrompido
            if (fs.existsSync(logFile)) {
                const backupFile = `${logFile}.corrupted`;
                fs.copyFileSync(logFile, backupFile);
            }
        }
    }
    
    // Adicionar nova entrada e salvar
    logs.push(logEntry);
    try {
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erro ao salvar logs: ${error}`);
    }
    
    return logEntry;
}

/**
 * Cria um embed padronizado para logs
 * @param {string} level Nível do log (INFO, SUCCESS, etc.)
 * @param {string} title Título do log
 * @param {string} description Descrição do log
 * @param {Array} fields Campos adicionais (name, value, inline)
 * @param {object} options Opções adicionais (footer, author, etc.)
 * @returns {EmbedBuilder} Embed formatado
 */
function createLogEmbed(level, title, description, fields = [], options = {}) {
    const logLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    
    const embed = new EmbedBuilder()
        .setColor(logLevel.color)
        .setTitle(`${logLevel.emoji} ${title}`)
        .setDescription(description)
        .setTimestamp();
    
    // Adicionar campos
    if (fields && fields.length > 0) {
        for (const field of fields) {
            if (field.name && field.value) {
                embed.addFields({ 
                    name: field.name, 
                    value: field.value, 
                    inline: field.inline || false 
                });
            }
        }
    }
    
    // Adicionar opções adicionais
    if (options.footer) {
        embed.setFooter({ text: options.footer });
    }
    
    if (options.author) {
        embed.setAuthor(options.author);
    }
    
    if (options.thumbnail) {
        embed.setThumbnail(options.thumbnail);
    }
    
    return embed;
}

/**
 * Envia log para canal específico com formato padronizado
 * @param {TextChannel} channel Canal para enviar o log
 * @param {string} level Nível do log (INFO, SUCCESS, etc.)
 * @param {string} title Título do log
 * @param {string} description Descrição do log
 * @param {Array} fields Campos adicionais (name, value, inline)
 * @param {object} options Opções adicionais (footer, author, etc.)
 * @returns {Promise<Message>} Mensagem enviada
 */
async function sendLog(channel, level, title, description, fields = [], options = {}) {
    if (!channel) return null;
    
    const embed = createLogEmbed(level, title, description, fields, options);
    
    try {
        const message = await channel.send({ embeds: [embed] });
        
        // Guardar log em arquivo
        const logType = level.toLowerCase();
        const logData = {
            level,
            title,
            description,
            fields,
            options,
            messageId: message.id,
            channelId: channel.id,
            guildId: channel.guild.id
        };
        
        saveLogToFile(logType, logData);
        
        return message;
    } catch (error) {
        console.error(`Erro ao enviar log para canal: ${error}`);
        return null;
    }
}

/**
 * Envia log de filtragem
 * @param {TextChannel} channel Canal de logs
 * @param {object} data Dados do filtro
 * @returns {Promise<Message>} Mensagem enviada
 */
async function logFilter(channel, data) {
    const { author, content, explanation, level } = data;
    
    const fields = [
        { name: 'Usuário', value: `${author.tag} (${author.id})`, inline: true },
        { name: 'Nível da Infração', value: level.toUpperCase(), inline: true },
        { name: 'Canal', value: `<#${data.channelId}>`, inline: true },
        { name: 'Conteúdo', value: content || 'N/A' },
        { name: 'Motivo', value: explanation || 'N/A' }
    ];
    
    const options = {
        footer: `ID: ${generateLogId()} • Canal: #${channel.name}`,
        thumbnail: author.displayAvatarURL({ dynamic: true })
    };
    
    return await sendLog(
        channel, 
        'FILTER', 
        'Mensagem Filtrada', 
        `Uma mensagem de ${author.username} foi filtrada.`, 
        fields, 
        options
    );
}

/**
 * Envia log de punição
 * @param {TextChannel} channel Canal de logs
 * @param {object} data Dados da punição
 * @returns {Promise<Message>} Mensagem enviada
 */
async function logPunishment(channel, data) {
    const { userId, username, type, reason, details, executor } = data;
    
    const fields = [
        { name: 'Usuário', value: `<@${userId}> (${username})`, inline: true },
        { name: 'Tipo de Punição', value: type, inline: true },
        { name: 'Aplicado por', value: executor ? `<@${executor.id}>` : 'Sistema', inline: true },
        { name: 'Motivo', value: reason || 'Não especificado' },
        { name: 'Detalhes', value: details || 'N/A' }
    ];
    
    const options = {
        footer: `ID: ${generateLogId()} • Canal: #${channel.name}`
    };
    
    return await sendLog(
        channel, 
        'PUNISH', 
        'Punição Aplicada', 
        `Uma punição foi aplicada ao usuário ${username}.`, 
        fields, 
        options
    );
}

/**
 * Envia log de whitelist
 * @param {TextChannel} channel Canal de logs
 * @param {object} data Dados da whitelist
 * @returns {Promise<Message>} Mensagem enviada
 */
async function logWhitelist(channel, data) {
    const { userId, username, status, approver } = data;
    
    let level, title, description;
    if (status === 'pendente') {
        level = 'INFO';
        title = 'Nova Solicitação de Whitelist';
        description = `${username} solicitou whitelist.`;
    } else if (status === 'aprovado') {
        level = 'SUCCESS';
        title = 'Whitelist Aprovada';
        description = `A whitelist de ${username} foi aprovada.`;
    } else if (status === 'rejeitado') {
        level = 'WARNING';
        title = 'Whitelist Rejeitada';
        description = `A whitelist de ${username} foi rejeitada.`;
    }
    
    const fields = [
        { name: 'Usuário', value: `<@${userId}> (${username})`, inline: true },
        { name: 'Status', value: status.toUpperCase(), inline: true }
    ];
    
    if (approver) {
        fields.push({ name: 'Aprovador/Rejeitador', value: approver, inline: true });
    }
    
    // Adicionar outros campos específicos da whitelist
    for (const [key, value] of Object.entries(data)) {
        if (!['userId', 'username', 'status', 'approver'].includes(key) && value) {
            fields.push({ name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: value.toString() });
        }
    }
    
    const options = {
        footer: `ID: ${generateLogId()} • Canal: #${channel.name}`
    };
    
    return await sendLog(channel, 'WHITELIST', title, description, fields, options);
}

/**
 * Carrega logs por tipo e período
 * @param {string} type Tipo de log (filtro, punição, whitelist)
 * @param {Date} startDate Data de início
 * @param {Date} endDate Data de fim
 * @returns {Array} Logs encontrados
 */
function getLogs(type, startDate = null, endDate = null) {
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
        return [];
    }
    
    // Filtrar arquivos pelo tipo
    const logFiles = fs.readdirSync(logsDir)
        .filter(file => file.startsWith(`${type}_`) && file.endsWith('.json'));
    
    let allLogs = [];
    
    // Carregar logs de cada arquivo
    for (const file of logFiles) {
        try {
            const fileContent = fs.readFileSync(path.join(logsDir, file), 'utf8');
            const logs = JSON.parse(fileContent);
            allLogs = allLogs.concat(logs);
        } catch (error) {
            console.error(`Erro ao ler arquivo de logs ${file}: ${error}`);
        }
    }
    
    // Filtrar por período, se especificado
    if (startDate || endDate) {
        allLogs = allLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            return (!startDate || logDate >= startDate) && (!endDate || logDate <= endDate);
        });
    }
    
    return allLogs;
}

/**
 * Exporta logs para arquivo CSV
 * @param {string} type Tipo de log (filtro, punição, whitelist)
 * @param {Date} startDate Data de início
 * @param {Date} endDate Data de fim
 * @returns {string} Caminho do arquivo CSV
 */
function exportLogsToCSV(type, startDate = null, endDate = null) {
    const logs = getLogs(type, startDate, endDate);
    if (logs.length === 0) {
        return null;
    }
    
    // Criar diretório de exportação se não existir
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Gerar nome do arquivo
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const fileName = `${type}_logs_${dateStr}.csv`;
    const filePath = path.join(exportDir, fileName);
    
    // Obter cabeçalhos (colunas) com base no primeiro log
    const headers = ['id', 'timestamp', ...Object.keys(logs[0]).filter(key => !['id', 'timestamp'].includes(key))];
    
    // Criar conteúdo CSV
    let csvContent = headers.join(',') + '\n';
    
    for (const log of logs) {
        const row = [];
        for (const header of headers) {
            let value = log[header] || '';
            
            // Formatar valores complexos
            if (typeof value === 'object') {
                value = JSON.stringify(value).replace(/,/g, ';').replace(/"/g, '""');
            }
            
            // Colocar entre aspas se contiver vírgula
            if (value.toString().includes(',')) {
                value = `"${value}"`;
            }
            
            row.push(value);
        }
        csvContent += row.join(',') + '\n';
    }
    
    // Salvar arquivo
    fs.writeFileSync(filePath, csvContent, 'utf8');
    
    return filePath;
}

module.exports = {
    LOG_LEVELS,
    logFilter,
    logPunishment,
    logWhitelist,
    sendLog,s
    getLogs,
    exportLogsToCSV,
    createLogEmbed
};
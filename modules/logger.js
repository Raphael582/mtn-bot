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
 * Encontra ou cria canal de logs
 * @param {Guild} guild Servidor Discord
 * @param {string} channelName Nome do canal de logs
 * @returns {Promise<TextChannel|null>} Canal de logs ou null se não possível
 */
async function findOrCreateLogChannel(guild, channelName) {
    try {
        // Verificar se o canal já existe
        let logChannel = guild.channels.cache.find(channel => channel.name === channelName);
        
        // Se o canal não existir, criar
        if (!logChannel) {
            logChannel = await guild.channels.create({
                name: channelName,
                type: 0, // 0 = GUILD_TEXT
                permissionOverwrites: [
                    {
                        id: guild.id, // @everyone
                        deny: ['ViewChannel'] // Esconder o canal de todos
                    },
                    {
                        id: guild.roles.cache.find(role => role.name === 'Admin')?.id || guild.ownerId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    }
                ],
                topic: `Canal de logs para ${channelName}`
            });
            console.log(`✅ Canal de logs ${channelName} criado com sucesso!`);
        }
        
        return logChannel;
    } catch (error) {
        console.error(`❌ Erro ao encontrar ou criar canal de logs: ${error}`);
        return null;
    }
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
 * @param {Guild} guild Servidor Discord
 * @param {object} data Dados do filtro
 * @returns {Promise<Message>} Mensagem enviada
 */
async function logFilter(guild, data) {
    const { author, content, explanation, level, channelId } = data;
    
    const logChannel = await findOrCreateLogChannel(guild, 'logs-filtro');
    if (!logChannel) return null;
    
    const fields = [
        { name: 'Usuário', value: `${author.tag} (${author.id})`, inline: true },
        { name: 'Nível da Infração', value: level.toUpperCase(), inline: true },
        { name: 'Canal', value: `<#${channelId}>`, inline: true },
        { name: 'Conteúdo', value: content || 'N/A' },
        { name: 'Motivo', value: explanation || 'N/A' }
    ];
    
    const options = {
        footer: `ID: ${generateLogId()} • Canal: #${logChannel.name}`,
        thumbnail: author.displayAvatarURL({ dynamic: true })
    };
    
    return await sendLog(
        logChannel, 
        'FILTER', 
        'Mensagem Filtrada', 
        `Uma mensagem de ${author.username} foi filtrada.`, 
        fields, 
        options
    );
}

/**
 * Envia log de punição
 * @param {Guild} guild Servidor Discord
 * @param {object} data Dados da punição
 * @returns {Promise<Message>} Mensagem enviada
 */
async function logPunishment(guild, data) {
    const { userId, username, type, reason, details, executor } = data;
    
    const logChannel = await findOrCreateLogChannel(guild, 'logs-punicoes');
    if (!logChannel) return null;
    
    const fields = [
        { name: 'Usuário', value: `<@${userId}> (${username})`, inline: true },
        { name: 'Tipo de Punição', value: type, inline: true },
        { name: 'Aplicado por', value: executor ? `<@${executor.id}>` : 'Sistema', inline: true },
        { name: 'Motivo', value: reason || 'Não especificado' },
        { name: 'Detalhes', value: details || 'N/A' }
    ];
    
    const options = {
        footer: `ID: ${generateLogId()} • Canal: #${logChannel.name}`
    };
    
    return await sendLog(
        logChannel, 
        'PUNISH', 
        'Punição Aplicada', 
        `Uma punição foi aplicada ao usuário ${username}.`, 
        fields, 
        options
    );
}

/**
 * Envia log de whitelist
 * @param {Guild} guild Servidor Discord
 * @param {object} data Dados da whitelist
 * @returns {Promise<Message>} Mensagem enviada
 */
async function logWhitelist(guild, data) {
    const { userId, username, status, approver } = data;
    
    const logChannel = await findOrCreateLogChannel(guild, 'logs-wl');
    if (!logChannel) return null;
    
    let level, title, description;
    if (status === 'pendente' || status === 'Pendente') {
        level = 'INFO';
        title = 'Nova Solicitação de Whitelist';
        description = `${username} solicitou whitelist.`;
    } else if (status === 'aprovado' || status === 'Aprovado') {
        level = 'SUCCESS';
        title = 'Whitelist Aprovada';
        description = `A whitelist de ${username} foi aprovada.`;
    } else if (status === 'rejeitado' || status === 'Rejeitado') {
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
            fields.push({ 
                name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), 
                value: value.toString() 
            });
        }
    }
    
    const options = {
        footer: `ID: ${generateLogId()} • Canal: #${logChannel.name}`
    };
    
    return await sendLog(logChannel, 'WHITELIST', title, description, fields, options);
}

/**
 * Registra um erro no sistema
 * @param {Guild} guild Servidor Discord (opcional)
 * @param {string} context Contexto do erro (módulo, comando, etc.)
 * @param {Error} error Objeto de erro
 * @param {object} additionalData Dados adicionais sobre o erro
 */
async function logError(guild, context, error, additionalData = {}) {
    // Salvar no arquivo independentemente do canal
    const errorData = {
        context,
        message: error.message,
        stack: error.stack,
        ...additionalData,
    };
    
    saveLogToFile('error', errorData);
    
    // Se tiver guild, tentar enviar para o canal de logs
    if (guild) {
        const logChannel = await findOrCreateLogChannel(guild, 'logs-erros');
        if (!logChannel) return;
        
        const fields = [
            { name: 'Contexto', value: context, inline: true },
            { name: 'Mensagem', value: error.message },
        ];
        
        // Adicionar stack trace formatado
        if (error.stack) {
            // Limitar tamanho do stack trace para não exceder limites do Discord
            const stackTrace = error.stack.substring(0, 1000) + (error.stack.length > 1000 ? '...' : '');
            fields.push({ name: 'Stack Trace', value: `\`\`\`\n${stackTrace}\n\`\`\`` });
        }
        
        // Adicionar dados adicionais
        for (const [key, value] of Object.entries(additionalData)) {
            if (value) {
                fields.push({ 
                    name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), 
                    value: typeof value === 'object' ? JSON.stringify(value, null, 2) : value.toString() 
                });
            }
        }
        
        await sendLog(
            logChannel,
            'ERROR',
            'Erro no Sistema',
            `Um erro ocorreu no sistema: ${context}`,
            fields,
            { footer: `ID: ${generateLogId()}` }
        );
    }
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
    logError,
    sendLog,
    getLogs,
    exportLogsToCSV,
    createLogEmbed,
    findOrCreateLogChannel
};
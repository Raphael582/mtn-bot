const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const Logger = require('./logger');

// Estrutura de dados para armazenar infrações de usuários
const USUARIO_PADRAO = {
    infracoesLeves: 0,
    infracoesMedidas: 0,
    infracoesGraves: 0,
    infracoesExtremas: 0,
    advertencias: 0,
    silenciamentos: 0,
    ultimaInfracao: null,
    historico: []
};

// Configurações do sistema de punição
const PUNISH_CONFIG = {
    // Quantas infrações leves geram uma infração média
    levesParaMedia: 3,
    
    // Quantas infrações médias geram uma infração grave
    mediasParaGrave: 2,
    
    // Quantas advertências resultam em banimento
    advertenciasParaBanimento: 3,
    
    // Duração do silenciamento em minutos por nível de infração
    duracaoSilenciamento: {
        leve: 30,    // 30 minutos
        media: 120,   // 2 horas
        grave: 1440,  // 24 horas
        extrema: 4320 // 3 dias
    },
    
    // Canais e cargos
    punishLogChannelName: 'logs-punicoes',
    moderatorRoles: ['Moderador', 'Admin', 'Administrador', 'Staff'],
};

// Caminho para o arquivo de infrações
const getInfracoesPath = () => {
    return path.join(__dirname, '..', 'database', 'infracoes.json');
};

// Função para garantir que o canal de logs de punições existe
async function ensurePunishLogChannel(guild) {
    // Verificar se o canal já existe
    let logChannel = guild.channels.cache.find(channel => channel.name === PUNISH_CONFIG.punishLogChannelName);
    
    // Se o canal não existir, criar
    if (!logChannel) {
        try {
            logChannel = await guild.channels.create({
                name: PUNISH_CONFIG.punishLogChannelName,
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
                topic: 'Logs de punições aplicadas pelo sistema'
            });
            console.log(`✅ Canal de logs de punições ${PUNISH_CONFIG.punishLogChannelName} criado com sucesso!`);
        } catch (error) {
            console.error(`❌ Erro ao criar canal de logs de punições: ${error}`);
            return null;
        }
    }
    
    return logChannel;
}

// Função para verificar se um usuário é moderador
async function isUserModerator(member) {
    return member.roles.cache.some(role => PUNISH_CONFIG.moderatorRoles.includes(role.name));
}

// Função para aplicar punição automática
async function aplicarPunicaoAutomatica(userId, username, tipo, motivo, message, client) {
    try {
        // Carregar infrações atuais
        const infracoesPath = getInfracoesPath();
        let infracoes = {};
        
        if (fs.existsSync(infracoesPath)) {
            infracoes = JSON.parse(fs.readFileSync(infracoesPath));
        }
        
        // Inicializar dados do usuário se não existirem
        if (!infracoes[userId]) {
            infracoes[userId] = { ...USUARIO_PADRAO, username };
        }
        
        // Atualizar contadores baseado no tipo de infração
        switch (tipo) {
            case 'leve':
                infracoes[userId].infracoesLeves++;
                break;
            case 'media':
                infracoes[userId].infracoesMedidas++;
                break;
            case 'grave':
                infracoes[userId].infracoesGraves++;
                break;
            case 'extrema':
                infracoes[userId].infracoesExtremas++;
                break;
        }
        
        // Registrar a infração no histórico
        const infracao = {
            tipo,
            motivo,
            data: new Date().toISOString(),
            canal: message ? message.channel.name : 'N/A'
        };
        
        infracoes[userId].ultimaInfracao = infracao;
        infracoes[userId].historico.push(infracao);
        
        // Determinar a punição baseada no tipo e histórico
        let punicao = {
            tipo: 'advertencia',
            detalhes: 'Advertência verbal'
        };
        
        let requerAssistenciaStaff = false;
        
        // Lógica de punição progressiva
        if (infracoes[userId].infracoesLeves >= PUNISH_CONFIG.levesParaMedia) {
            punicao = {
                tipo: 'silenciamento',
                detalhes: `Silenciamento por ${PUNISH_CONFIG.duracaoSilenciamento.media} minutos`
            };
            requerAssistenciaStaff = true;
        }
        
        if (infracoes[userId].infracoesMedidas >= PUNISH_CONFIG.mediasParaGrave) {
            punicao = {
                tipo: 'silenciamento',
                detalhes: `Silenciamento por ${PUNISH_CONFIG.duracaoSilenciamento.grave} minutos`
            };
            requerAssistenciaStaff = true;
        }
        
        if (infracoes[userId].infracoesGraves >= 2) {
            punicao = {
                tipo: 'banimento',
                detalhes: 'Banimento permanente'
            };
            requerAssistenciaStaff = true;
        }
        
        // Salvar infrações atualizadas
        fs.writeFileSync(infracoesPath, JSON.stringify(infracoes, null, 2));
        
        // Registrar a punição no sistema de logs
        if (message && message.guild) {
            const logger = new Logger(client);
            await logger.logPunishment(message.guild.members.cache.get(userId), punicao.tipo, motivo, message.author);
        }
        
        // Retornar informações da punição
        return {
            tipo: punicao.tipo,
            detalhes: punicao.detalhes,
            requerAssistenciaStaff: requerAssistenciaStaff
        };
    } catch (error) {
        console.error('Erro ao aplicar punição automática:', error);
        if (message && message.guild) {
            const logger = new Logger(client);
            await logger.logError(message.guild, 'punicao', error, {
                userId,
                username,
                tipo,
                motivo
            });
        }
        return null;
    }
}

// Exportar as funções principais
module.exports = {
    registrarInfracao: aplicarPunicaoAutomatica,
    carregarInfracoes: () => {
        const infracoesPath = getInfracoesPath();
        if (fs.existsSync(infracoesPath)) {
            return JSON.parse(fs.readFileSync(infracoesPath));
        }
        return {};
    },
    ensurePunishLogChannel,
    isUserModerator,
    PUNISH_CONFIG
};
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

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

// Função para carregar os dados de infrações
function carregarInfracoes() {
    const filePath = getInfracoesPath();
    
    // Verificar se o diretório existe, se não, criar
    const dirPath = path.join(__dirname, '..', 'database');
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Verificar se o arquivo existe
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`❌ Erro ao carregar dados de infrações: ${error}`);
            // Se houver erro, criar um backup e retornar objeto vazio
            if (fs.existsSync(filePath)) {
                const backupPath = `${filePath}.backup-${Date.now()}.json`;
                fs.copyFileSync(filePath, backupPath);
                console.log(`✅ Backup de infrações criado em: ${backupPath}`);
            }
            return {};
        }
    } else {
        // Se o arquivo não existe, criar com objeto vazio
        fs.writeFileSync(filePath, '{}', 'utf8');
        return {};
    }
}

// Função para salvar os dados de infrações
function salvarInfracoes(infracoes) {
    const filePath = getInfracoesPath();
    
    // Verificar se o diretório existe, se não, criar
    const dirPath = path.join(__dirname, '..', 'database');
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(infracoes, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error(`❌ Erro ao salvar dados de infrações: ${error}`);
        return false;
    }
}

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

// Verificar se um usuário é moderador
function isUserModerator(member) {
    return member.roles.cache.some(role => 
        PUNISH_CONFIG.moderatorRoles.includes(role.name) || 
        member.permissions.has('Administrator')
    );
}

// Função para registrar uma infração
async function registrarInfracao(userId, username, tipo, motivo, message, client) {
    // Carregar infrações atuais
    const infracoes = carregarInfracoes();
    
    // Se o usuário não existe no registro, criar
    if (!infracoes[userId]) {
        infracoes[userId] = {...USUARIO_PADRAO, username: username};
    }
    
    // Atualizar o nome de usuário (pode ter mudado)
    infracoes[userId].username = username;
    
    // Adicionar a infração ao histórico
    const novaInfracao = {
        tipo: tipo,
        motivo: motivo,
        data: new Date().toISOString(),
        canal: message ? message.channel.name : 'Desconhecido'
    };
    
    infracoes[userId].historico.push(novaInfracao);
    infracoes[userId].ultimaInfracao = novaInfracao;
    
    // Incrementar contador de infração
    switch (tipo.toLowerCase()) {
        case 'leve':
            infracoes[userId].infracoesLeves++;
            // Verificar se atingiu o limite para ser convertida em média
            if (infracoes[userId].infracoesLeves >= PUNISH_CONFIG.levesParaMedia) {
                infracoes[userId].infracoesLeves -= PUNISH_CONFIG.levesParaMedia;
                infracoes[userId].infracoesMedidas++;
                console.log(`⚠️ ${username} (${userId}) acumulou ${PUNISH_CONFIG.levesParaMedia} infrações leves, convertidas em 1 infração média.`);
            }
            break;
        case 'média':
        case 'media':
            infracoes[userId].infracoesMedidas++;
            // Verificar se atingiu o limite para ser convertida em grave
            if (infracoes[userId].infracoesMedidas >= PUNISH_CONFIG.mediasParaGrave) {
                infracoes[userId].infracoesMedidas -= PUNISH_CONFIG.mediasParaGrave;
                infracoes[userId].infracoesGraves++;
                console.log(`⚠️ ${username} (${userId}) acumulou ${PUNISH_CONFIG.mediasParaGrave} infrações médias, convertidas em 1 infração grave.`);
            }
            break;
        case 'grave':
            infracoes[userId].infracoesGraves++;
            break;
        case 'extrema':
            infracoes[userId].infracoesExtremas++;
            break;
    }
    
    // Salvar infrações
    salvarInfracoes(infracoes);
    
    // Aplicar punição automática com base no tipo de infração
    return await aplicarPunicaoAutomatica(userId, username, tipo, motivo, message, client);
}

// Função para aplicar punição automática
async function aplicarPunicaoAutomatica(userId, username, tipo, motivo, message, client) {
    // Carregar infrações atuais
    const infracoes = carregarInfracoes();
    const usuario = infracoes[userId];
    
    // Se não encontrar o usuário (não deveria acontecer)
    if (!usuario) {
        console.error(`❌ Usuário ${userId} não encontrado no registro de infrações.`);
        return null;
    }
    
    // Definir punição com base no tipo de infração
    let punicao = null;
    let requerAssistenciaStaff = false;
    
    switch (tipo.toLowerCase()) {
        case 'leve':
            // Infrações leves geralmente resultam apenas em aviso
            punicao = {
                tipo: 'aviso',
                detalhes: 'Os avisos por infrações leves são cumulativos e podem resultar em punições mais severas.'
            };
            break;
        case 'média':
        case 'media':
            // Infração média: aumento na contagem de advertências
            usuario.advertencias++;
            infracoes[userId] = usuario;
            salvarInfracoes(infracoes);
            
            // Verificar se deve aplicar silenciamento temporário
            if (usuario.advertencias >= 2) {
                punicao = {
                    tipo: 'silenciamento',
                    duracao: PUNISH_CONFIG.duracaoSilenciamento.media,
                    detalhes: `Silenciamento temporário por ${PUNISH_CONFIG.duracaoSilenciamento.media} minutos.`
                };
                
                usuario.silenciamentos++;
                infracoes[userId] = usuario;
                salvarInfracoes(infracoes);
            } else {
                punicao = {
                    tipo: 'advertência',
                    detalhes: `Advertência formal (${usuario.advertencias}/${PUNISH_CONFIG.advertenciasParaBanimento}).`
                };
            }
            
            // Infrações médias podem requerer revisão de moderador
            requerAssistenciaStaff = true;
            break;
        case 'grave':
            // Infração grave: aplicar múltiplas advertências
            usuario.advertencias += 2; // Duas advertências por infração grave
            infracoes[userId] = usuario;
            salvarInfracoes(infracoes);
            
            punicao = {
                tipo: 'advertência_grave',
                detalhes: `Advertência grave (${usuario.advertencias}/${PUNISH_CONFIG.advertenciasParaBanimento}). Caso de revisão obrigatória pelos moderadores.`
            };
            
            // Infrações graves sempre requerem assistência de staff
            requerAssistenciaStaff = true;
            break;
        case 'extrema':
            // Infrações extremas resultam em banimento imediato (sujeito à confirmação de moderador)
            punicao = {
                tipo: 'banimento_pendente',
                detalhes: 'Caso de banimento pendente. Requer confirmação dos moderadores.'
            };
            
            // Infrações extremas sempre requerem assistência de staff
            requerAssistenciaStaff = true;
            break;
    }
    
    // Verificar se acumulou advertências suficientes para banimento
    if (usuario.advertencias >= PUNISH_CONFIG.advertenciasParaBanimento) {
        punicao = {
            tipo: 'banimento_pendente',
            detalhes: `Banimento pendente por acumular ${usuario.advertencias} advertências (limite: ${PUNISH_CONFIG.advertenciasParaBanimento}). Requer confirmação dos moderadores.`
        };
        requerAssistenciaStaff = true;
    }
    
    // Se o usuário estiver no servidor, aplicar a punição
    if (message && message.guild) {
        // Obter o membro
        let member;
        try {
            member = await message.guild.members.fetch(userId);
        } catch (error) {
            console.error(`❌ Não foi possível encontrar o membro ${userId} no servidor:`, error);
            member = null;
        }
        
        // Se o membro existir, aplicar a punição
        if (member) {
            // Verificar se o membro é moderador (não punir moderadores automaticamente)
            if (isUserModerator(member)) {
                console.log(`⚠️ O usuário ${username} (${userId}) é moderador e não será punido automaticamente.`);
                return {
                    tipo: 'aviso_interno',
                    detalhes: 'O usuário é moderador e não foi punido automaticamente.',
                    requerAssistenciaStaff: true
                };
            }
            
            // Aplicar a punição específica
            switch (punicao.tipo) {
                case 'silenciamento':
                    try {
                        // Tentar silenciar o membro temporariamente
                        await member.timeout(punicao.duracao * 60 * 1000, `[Automático] ${motivo}`);
                        console.log(`🔇 Usuário ${username} (${userId}) silenciado por ${punicao.duracao} minutos.`);
                    } catch (error) {
                        console.error(`❌ Não foi possível silenciar o membro ${userId}:`, error);
                        punicao.erro = 'Não foi possível aplicar o silenciamento.';
                    }
                    break;
                    
                case 'banimento_pendente':
                    // Banimentos pendentes não são aplicados automaticamente, apenas registrados para revisão
                    console.log(`⚠️ Banimento pendente para ${username} (${userId}). Requer confirmação de moderador.`);
                    break;
                    
                default:
                    // Outros tipos de punição (aviso, advertência) não exigem ação técnica
                    console.log(`📝 Punição registrada para ${username} (${userId}): ${punicao.tipo}`);
                    break;
            }
        }
    }
    
    // Registrar a punição no canal de logs
    if (message && message.guild) {
        // Garantir que o canal de logs de punições existe
        const logChannel = await ensurePunishLogChannel(message.guild);
        
        if (logChannel) {
            // Criar embed para o log de punição
            const embed = new EmbedBuilder()
                .setColor(getTipoColor(tipo))
                .setTitle(`🚫 Punição Aplicada: ${tipo.toUpperCase()}`)
                .setDescription(`**Usuário:** ${username} (<@${userId}>)`)
                .addFields(
                    { name: 'Motivo', value: motivo },
                    { name: 'Punição', value: punicao.detalhes },
                    { name: 'Canal', value: message ? `#${message.channel.name}` : 'N/A' },
                    { name: 'Requer Assistência', value: requerAssistenciaStaff ? '✅ Sim' : '❌ Não' }
                )
                .setFooter({ text: `ID do Usuário: ${userId}` })
                .setTimestamp();
            
            // Adicionar botões de ação para moderadores, se necessário
            // Esta parte requer implementação na lógica de interação do bot
            
            await logChannel.send({ embeds: [embed] });
        }
    }
    
    // Retornar informações da punição
    return {
        tipo: punicao.tipo,
        detalhes: punicao.detalhes,
        requerAssistenciaStaff: requerAssistenciaStaff
    };
}

// Função para obter cor com base no tipo de infração
function getTipoColor(tipo) {
    switch (tipo.toLowerCase()) {
        case 'leve':
            return 0xFFFF00; // Amarelo
        case 'média':
        case 'media':
            return 0xFFA500; // Laranja
        case 'grave':
            return 0xFF0000; // Vermelho
        case 'extrema':
            return 0x990000; // Vermelho escuro
        default:
            return 0x0099FF; // Azul (padrão)
    }
}

// Exportar as funções principais
module.exports = {
    registrarInfracao,
    carregarInfracoes,
    ensurePunishLogChannel,
    isUserModerator,
    PUNISH_CONFIG
};
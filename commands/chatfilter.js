const { Events, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const punishmentSystem = require('../modules/punishment');
const logger = require('../modules/logger');

dotenv.config();

// Inicializa a API do Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Parâmetros de configuração do filtro
const FILTRO_CONFIG = {
    enabled: true,                // Filtro ativado por padrão
    logChannelName: 'logs-filtro',// Nome do canal para logs de mensagens filtradas
    whitelistedRoles: [],         // Cargos que não passam pelo filtro
    whitelistedChannels: [],      // Canais que não têm filtro
    whitelistedUsers: [],         // Usuários que não passam pelo filtro
    deleteMessage: true,          // Se deve excluir mensagens que violam o filtro
    notifyUser: true,             // Se deve notificar o usuário quando sua mensagem for filtrada
    notifyChannel: true,          // Se deve enviar uma notificação no canal onde a mensagem foi filtrada
    minMessageLength: 5,          // Comprimento mínimo da mensagem para ser filtrada (evita falsos positivos)
    applySanctions: true,         // Se deve aplicar sanções aos usuários que infringirem as regras
};

// Carregar configuração do filtro
function loadFilterConfig() {
    const configPath = path.join(__dirname, '..', 'database', 'filter-config.json');
    
    // Verificar se o diretório existe, se não, criar
    const dirPath = path.join(__dirname, '..', 'database');
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Verificar se o arquivo de configuração existe
    if (fs.existsSync(configPath)) {
        try {
            const configJson = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configJson);
            
            // Mesclar configurações carregadas com as padrões
            return { ...FILTRO_CONFIG, ...config };
        } catch (error) {
            console.error(`❌ Erro ao carregar configuração do filtro: ${error}`);
            return FILTRO_CONFIG;
        }
    } else {
        // Se o arquivo não existe, criar com as configurações padrão
        try {
            fs.writeFileSync(configPath, JSON.stringify(FILTRO_CONFIG, null, 4), 'utf8');
            console.log('✅ Arquivo de configuração do filtro criado com configurações padrão');
        } catch (error) {
            console.error(`❌ Erro ao criar arquivo de configuração do filtro: ${error}`);
        }
        return FILTRO_CONFIG;
    }
}

// Salvar configuração do filtro
function saveFilterConfig(config) {
    const configPath = path.join(__dirname, '..', 'database', 'filter-config.json');
    
    // Verificar se o diretório existe, se não, criar
    const dirPath = path.join(__dirname, '..', 'database');
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');
        console.log('✅ Configuração do filtro salva com sucesso');
        return true;
    } catch (error) {
        console.error(`❌ Erro ao salvar configuração do filtro: ${error}`);
        return false;
    }
}

// Função para determinar o nível de infração com base no motivo
function determineInfractionLevel(explanation) {
    const explanation_lower = explanation.toLowerCase();
    
    // Identificar infrações extremas
    if (
        explanation_lower.includes('conteúdo ilegal') ||
        explanation_lower.includes('doxing') ||
        explanation_lower.includes('manipulação') || 
        explanation_lower.includes('exploração')
    ) {
        return 'extrema';
    }
    
    // Identificar infrações graves
    if (
        explanation_lower.includes('assédio') ||
        explanation_lower.includes('discriminação') ||
        explanation_lower.includes('privacidade') ||
        explanation_lower.includes('insulto')
    ) {
        return 'grave';
    }
    
    // Identificar infrações médias
    if (
        explanation_lower.includes('apoio a partidos de esquerda') ||
        explanation_lower.includes('apoio ao pt') ||
        explanation_lower.includes('apoio a lula') ||
        explanation_lower.includes('judeus') ||
        explanation_lower.includes('israel') ||
        explanation_lower.includes('palestina') ||
        explanation_lower.includes('conteúdo inapropriado') ||
        explanation_lower.includes('intolerância')
    ) {
        return 'média';
    }
    
    // Por padrão, classificar como infração leve
    return 'leve';
}

// Função para analisar mensagem com API do Gemini
async function analyzeMessage(message) {
    try {
        // Cria um modelo com configuração específica para filtragem
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.05,  // Temperatura muito baixa para reduzir criatividade
                topP: 0.7,
                topK: 10,
                maxOutputTokens: 1000,
            },
        });

        // Prompt modificado para instruir o modelo a identificar conteúdo indesejado
        const prompt = `
Você é um analisador de mensagens em um servidor Discord de extrema-direita. Sua ÚNICA tarefa é identificar e filtrar EXCLUSIVAMENTE estas categorias de conteúdo:

1) Ideias e retórica CLARAMENTE esquerdistas e comunistas, como:
   - Apoio explícito ao socialismo/comunismo
   - Defesa de políticas econômicas marxistas
   - Apoio a partidos declaradamente de esquerda (PT, PSOL, PCdoB)
   - Apoio a líderes como Lula, Boulos, etc.

2) Apoio a judeus, Israel ou Palestina, incluindo:
   - Defesa do estado de Israel ou do povo judeu
   - Apoio à causa palestina ou críticas a Israel
   - Discussões sobre o conflito Israel-Palestina

3) Conteúdo que claramente viola as regras:
   - Assédio direto a outros usuários (insultos pessoais explícitos)
   - Discriminação explícita baseada em raça
   - Compartilhamento de conteúdo ilegal
   - Tentativas evidentes de doxing
   - Spam repetitivo (mais de 3 mensagens idênticas seguidas)

IMPORTANTE: NÃO FILTRE:
- Mensagens curtas ou ambíguas
- Opiniões políticas de direita/extrema-direita
- Mensagens neutras ou conversas normais
- Expressões de opinião que não mencionem explicitamente os tópicos proibidos
- Discussões sobre o filtro em si ou o servidor
- Conteúdo conservador ou nacionalista
- Mensagens que pareçam críticas mas não têm alvo claro

Para qualquer mensagem, responda APENAS com:

1. "PERMITIR" se a mensagem NÃO contiver CLARAMENTE conteúdo das categorias proibidas.
2. "FILTRAR" seguido de uma explicação CURTA e ESPECÍFICA se a mensagem contiver CLARAMENTE conteúdo proibido.

Na explicação, indique ESPECIFICAMENTE qual conteúdo proibido foi encontrado. Seja muito restritivo e filtre APENAS quando tiver CERTEZA ABSOLUTA.

MENSAGEM A ANALISAR:
"${message.content}"
`;

        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();

        // Verificar se a resposta começa com FILTRAR
        const shouldFilter = response.toUpperCase().startsWith('FILTRAR');
        
        // Extrai a explicação (removendo o "FILTRAR" do começo)
        const explanation = shouldFilter 
            ? response.substring(response.indexOf('FILTRAR') + 'FILTRAR'.length).trim() 
            : "Mensagem permitida";

        return {
            shouldFilter: shouldFilter,
            explanation: explanation,
            originalMessage: message.content
        };
    } catch (error) {
        console.error(`❌ Erro ao analisar mensagem com API Gemini: ${error}`);
        return {
            shouldFilter: false,
            explanation: "Erro ao analisar mensagem",
            originalMessage: message.content
        };
    }
}

// Função para criar o canal de logs se não existir
async function ensureLogChannel(guild) {
    try {
        return await logger.findOrCreateLogChannel(guild, 'logs-filtro');
    } catch (error) {
        console.error(`❌ Erro ao criar canal de logs: ${error}`);
        return null;
    }
}

// Função para lidar com eventos de mensagem
async function handleMessage(message, client) {
    // Ignorar mensagens de bots
    if (message.author.bot) return;
    
    // Carregar configuração
    const config = loadFilterConfig();
    
    // Se o filtro estiver desativado, ignorar
    if (!config.enabled) return;
    
    // Ignorar mensagens muito curtas (para evitar falsos positivos)
    if (message.content.length < config.minMessageLength) return;
    
    // Verificar se o usuário está na lista de exceções
    if (config.whitelistedUsers.includes(message.author.id)) return;
    
    // Verificar se o canal está na lista de exceções
    if (config.whitelistedChannels.includes(message.channel.id)) return;
    
    // Verificar se o usuário tem um cargo da lista de exceções
    const member = await message.guild.members.fetch(message.author.id);
    
    // Verificar se o usuário é moderador (moderadores não são filtrados)
    if (punishmentSystem.isUserModerator(member)) return;
    
    const hasWhitelistedRole = member.roles.cache.some(role => 
        config.whitelistedRoles.includes(role.id)
    );
    if (hasWhitelistedRole) return;
    
    // Analisar a mensagem
    const analysis = await analyzeMessage(message);
    
    // Se a mensagem for considerada para filtragem
    if (analysis.shouldFilter) {
        // Registrar a mensagem filtrada
        console.log(`🔍 Mensagem filtrada de ${message.author.tag}: ${message.content}`);
        
        // Garantir que o canal de logs existe
        const logChannel = await ensureLogChannel(message.guild);
        
        // Determinar o nível de infração
        const infractionLevel = determineInfractionLevel(analysis.explanation);
        
        if (logChannel) {
            // Usar o novo sistema de logs
            await logger.logFilter(message.guild, {
                author: message.author,
                content: message.content,
                explanation: analysis.explanation,
                level: infractionLevel,
                channelId: message.channel.id
            });
        }
        
        // Criar o embed para notificação pública e privada
        const filterEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚫 Mensagem Removida')
            .setDescription(`A mensagem de <@${message.author.id}> foi removida.`)
            .addFields({ name: 'Motivo', value: analysis.explanation })
            .setFooter({ text: 'Este conteúdo não é permitido em nosso servidor.' })
            .setTimestamp();
            
        // Se configurado para notificar no canal
        if (config.notifyChannel) {
            try {
                await message.channel.send({ 
                    embeds: [filterEmbed],
                });
            } catch (error) {
                console.error(`❌ Erro ao enviar notificação no canal: ${error}`);
            }
        }
        
        // Se configurado para excluir mensagens filtradas
        if (config.deleteMessage) {
            try {
                await message.delete();
            } catch (error) {
                console.error(`❌ Erro ao excluir mensagem filtrada: ${error}`);
            }
        }
        
        // Se configurado para notificar o usuário
        if (config.notifyUser) {
            try {
                // Criar um embed específico para DM com mais detalhes
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🚫 Sua Mensagem Foi Removida')
                    .setDescription(`Sua mensagem no canal **#${message.channel.name}** foi removida. Observe as regras do servidor.`)
                    .addFields(
                        { name: 'Conteúdo da Mensagem', value: `"${message.content}"` },
                        { name: 'Motivo da Remoção', value: analysis.explanation },
                        { name: 'Nível da Infração', value: infractionLevel.toUpperCase() }
                    )
                    .setFooter({ 
                        text: 'Este conteúdo não é permitido em nosso servidor.' 
                    })
                    .setTimestamp();
                    
                await message.author.send({ embeds: [dmEmbed] });
            } catch (error) {
                // Se não conseguir enviar DM, ignora silenciosamente
                console.error(`❌ Não foi possível enviar DM para ${message.author.tag}: ${error}`);
            }
        }
        
        // Registrar a infração e aplicar punição, se configurado
        if (config.applySanctions) {
            try {
                const punishment = await punishmentSystem.registrarInfracao(
                    message.author.id,
                    message.author.tag,
                    infractionLevel,
                    analysis.explanation,
                    message,
                    client
                );
                
                console.log(`✅ Punição aplicada a ${message.author.tag}: ${punishment.tipo}`);
                
                // Se a punição requerer assistência de moderador, enviar notificação
                if (punishment.requerAssistenciaStaff) {
                    // Garantir que o canal de logs de punições existe
                    const punishLogChannel = await punishmentSystem.ensurePunishLogChannel(message.guild);
                    
                    if (punishLogChannel) {
                        await punishLogChannel.send({
                            content: `⚠️ Atenção <@&${message.guild.roles.cache.find(r => r.name === 'Admin')?.id || ''}> <@&${message.guild.roles.cache.find(r => r.name === 'Moderador')?.id || ''}>: Infração detectada que requer revisão de moderador.`,
                        });
                    }
                }
            } catch (error) {
                console.error(`❌ Erro ao registrar infração para ${message.author.tag}:`, error);
            }
        }
        
        return true; // Mensagem filtrada
    }
    
    return false; // Mensagem permitida
}

// Comandos para gerenciar o filtro
const commands = {
    // Definição do comando no formato correto para o Discord.js
    data: {
        name: 'filtro',
        description: 'Gerencia o sistema de filtro de mensagens'
    },

    // Função de execução
    async execute(interaction, client) {
        // Verificar permissões (apenas administradores)
        if (!interaction.member.permissions.has('Administrator') && !punishmentSystem.isUserModerator(interaction.member)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para usar este comando.',
                ephemeral: true
            });
        }
        
        const subCommand = interaction.options.getSubcommand(false);
        
        // Carregar configuração
        const config = loadFilterConfig();
        
        // Se não for um subcomando válido, mostrar status
        if (!subCommand) {
            const embed = {
                color: config.enabled ? 0x00ff00 : 0xff0000,
                title: '🔍 Status do Filtro',
                description: `O filtro está atualmente **${config.enabled ? 'ATIVADO' : 'DESATIVADO'}**`,
                fields: [
                    {
                        name: '⚙️ Configurações',
                        value: `- Excluir mensagens: ${config.deleteMessage ? 'Sim' : 'Não'}\n- Notificar usuários: ${config.notifyUser ? 'Sim' : 'Não'}\n- Notificação pública: ${config.notifyChannel ? 'Sim' : 'Não'}\n- Comprimento mínimo: ${config.minMessageLength} caracteres\n- Aplicar punições: ${config.applySanctions ? 'Sim' : 'Não'}\n- Canal de logs: #${config.logChannelName}`
                    },
                    {
                        name: '🎯 O Que é Filtrado',
                        value: '• Conteúdo explicitamente esquerdista/comunista\n• Apoio ao PT, PSOL, PCdoB e seus líderes\n• Apoio a judeus, Israel ou Palestina\n• Violações sérias das regras do servidor'
                    },
                    {
                        name: '⚖️ Sistema de Punições',
                        value: `• Infração **Leve**: Aviso\n• Infração **Média**: Advertência (${punishmentSystem.PUNISH_CONFIG.mediasParaGrave} infrações = 1 grave)\n• Infração **Grave**: Advertência múltipla + revisão\n• Infração **Extrema**: Banimento pendente (requer aprovação)`
                    },
                    {
                        name: '👥 Usuários na lista de exceções',
                        value: config.whitelistedUsers.length > 0 
                            ? config.whitelistedUsers.map(id => `<@${id}>`).join(', ')
                            : 'Nenhum'
                    },
                    {
                        name: '📝 Canais na lista de exceções',
                        value: config.whitelistedChannels.length > 0
                            ? config.whitelistedChannels.map(id => `<#${id}>`).join(', ')
                            : 'Nenhum'
                    },
                    {
                        name: '🏷️ Cargos na lista de exceções',
                        value: config.whitelistedRoles.length > 0
                            ? config.whitelistedRoles.map(id => `<@&${id}>`).join(', ')
                            : 'Nenhum'
                    }
                ],
                timestamp: new Date(),
                footer: {
                    text: 'Sistema de Filtro'
                }
            };
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Ativar filtro
        if (subCommand === 'ativar') {
            if (config.enabled) {
                return await interaction.reply({
                    content: '⚠️ O filtro já está ativado.',
                    ephemeral: true
                });
            }
            
            config.enabled = true;
            saveFilterConfig(config);
            
            return await interaction.reply({
                content: '✅ Filtro ativado com sucesso!',
                ephemeral: true
            });
        }
        
        // Desativar filtro
        if (subCommand === 'desativar') {
            if (!config.enabled) {
                return await interaction.reply({
                    content: '⚠️ O filtro já está desativado.',
                    ephemeral: true
                });
            }
            
            config.enabled = false;
            saveFilterConfig(config);
            
            return await interaction.reply({
                content: '✅ Filtro desativado com sucesso!',
                ephemeral: true
            });
        }
        
        // Ajustar comprimento mínimo da mensagem
        if (subCommand === 'minimo') {
            const novoMinimo = interaction.options.getInteger('caracteres');
            
            if (novoMinimo < 1 || novoMinimo > 50) {
                return await interaction.reply({
                    content: '❌ O comprimento mínimo deve estar entre 1 e 50 caracteres.',
                    ephemeral: true
                });
            }
            
            config.minMessageLength = novoMinimo;
            saveFilterConfig(config);
            
            return await interaction.reply({
                content: `✅ Comprimento mínimo ajustado para ${novoMinimo} caracteres.`,
                ephemeral: true
            });
        }
        
        // Ativar/desativar sistema de punição
        if (subCommand === 'punicoes') {
            config.applySanctions = !config.applySanctions;
            saveFilterConfig(config);
            
            return await interaction.reply({
                content: `✅ Sistema de punições ${config.applySanctions ? 'ativado' : 'desativado'} com sucesso!`,
                ephemeral: true
            });
        }
        
        // Alternar notificação pública
        if (subCommand === 'publico') {
            config.notifyChannel = !config.notifyChannel;
            saveFilterConfig(config);
            
            return await interaction.reply({
                content: `✅ Notificação pública ${config.notifyChannel ? 'ativada' : 'desativada'} com sucesso!`,
                ephemeral: true
            });
        }
        
        // Comando para ver infrações de um usuário
        if (subCommand === 'infracoes') {
            const userTarget = interaction.options.getUser('usuario');
            if (!userTarget) {
                return await interaction.reply({
                    content: '❌ Você precisa especificar um usuário.',
                    ephemeral: true
                });
            }
            
            const infracoes = punishmentSystem.carregarInfracoes();
            const userInfracoes = infracoes[userTarget.id];
            
            if (!userInfracoes) {
                return await interaction.reply({
                    content: `✅ O usuário ${userTarget.tag} não possui infrações registradas.`,
                    ephemeral: true
                });
            }
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📊 Histórico de Infrações: ${userTarget.tag}`)
                .setDescription(`Resumo das infrações de <@${userTarget.id}>:`)
                .addFields(
                    { name: 'Infrações Leves', value: userInfracoes.infracoesLeves.toString(), inline: true },
                    { name: 'Infrações Médias', value: userInfracoes.infracoesMedidas.toString(), inline: true },
                    { name: 'Infrações Graves', value: userInfracoes.infracoesGraves.toString(), inline: true },
                    { name: 'Infrações Extremas', value: userInfracoes.infracoesExtremas.toString(), inline: true },
                    { name: 'Advertências', value: userInfracoes.advertencias.toString(), inline: true },
                    { name: 'Silenciamentos', value: userInfracoes.silenciamentos.toString(), inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `ID do Usuário: ${userTarget.id}` });
            
            // Adicionar histórico das últimas 5 infrações (se houver)
            if (userInfracoes.historico && userInfracoes.historico.length > 0) {
                const ultimasInfracoes = userInfracoes.historico.slice(-5).reverse(); // Últimas 5, mais recentes primeiro
                
                let historicoTexto = '';
                for (let i = 0; i < ultimasInfracoes.length; i++) {
                    const inf = ultimasInfracoes[i];
                    const data = new Date(inf.data).toLocaleString('pt-BR');
                    historicoTexto += `**${i+1}.** ${inf.tipo.toUpperCase()} (${data}): ${inf.motivo}\n`;
                }
                
                embed.addFields({ name: '📝 Últimas Infrações', value: historicoTexto });
            }
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Opção básica para quando o comando é chamado sem opções
        return await interaction.reply({
            content: `Sistema de filtro está ${config.enabled ? 'ativado' : 'desativado'}. Use /filtro status para mais informações.`,
            ephemeral: true
        });
    }
};

module.exports = {
    name: 'chatfilter',
    commands,
    handleMessage,
};
const { Events, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

class ChatFilter {
    constructor(client) {
        this.client = client;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        this.config = this.loadConfig();
        this.logger = new Logger(client);
        this.setupEventListeners();
    }

    loadConfig() {
        const configPath = path.join(__dirname, '..', 'database', 'filter-config.json');
        try {
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath));
            }
            return {
                enabled: true,
                filterAdmins: false,
                logChannelName: "logs-filtro",
                whitelistedRoles: [],
                whitelistedChannels: [],
                whitelistedUsers: [],
                deleteMessage: true,
                notifyUser: true
            };
        } catch (error) {
            console.error('Erro ao carregar configuração do filtro:', error);
            return null;
        }
    }

    saveConfig() {
        const configPath = path.join(__dirname, '..', 'database', 'filter-config.json');
        try {
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 4));
        } catch (error) {
            console.error('Erro ao salvar configuração do filtro:', error);
        }
    }

    setupEventListeners() {
        this.client.on(Events.MessageCreate, this.handleMessage.bind(this));
    }

    async handleMessage(message) {
        if (message.author.bot) return;

        // Verificar se o filtro está ativado
        if (!this.config.enabled) return;

        // Verificar se o usuário é administrador
        if (!this.config.filterAdmins && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return;
        }

        // Verificar se o canal está na whitelist
        if (this.config.whitelistedChannels.includes(message.channel.id)) {
            return;
        }

        // Verificar se o usuário está na whitelist
        if (this.config.whitelistedUsers.includes(message.author.id)) {
            return;
        }

        // Verificar se o usuário tem algum cargo na whitelist
        if (message.member.roles.cache.some(role => this.config.whitelistedRoles.includes(role.id))) {
            return;
        }

        // Verificar conteúdo com IA
        await this.checkContentWithAI(message);
    }

    async checkContentWithAI(message) {
        try {
            const prompt = `Você é um analisador de mensagens em um servidor Discord de extrema-direita. Sua ÚNICA tarefa é identificar e filtrar EXCLUSIVAMENTE estas categorias de conteúdo:

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

Analise a seguinte mensagem:
"${message.content}"

Responda APENAS com:
"PERMITIR" se a mensagem NÃO contiver CLARAMENTE conteúdo das categorias proibidas.
"FILTRAR" seguido de uma explicação CURTA e ESPECÍFICA se a mensagem contiver CLARAMENTE conteúdo proibido.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (text.startsWith('FILTRAR')) {
                await this.handleInappropriateContent(message, text);
            }
        } catch (error) {
            console.error('Erro ao verificar conteúdo com IA:', error);
            await this.logger.logError(message.guild, 'filtro-ia', error, {
                userId: message.author.id,
                messageId: message.id,
                channelId: message.channel.id,
                content: message.content
            });
        }
    }

    async handleInappropriateContent(message, aiResponse) {
        try {
            // Deletar mensagem se configurado
            if (this.config.deleteMessage) {
                await message.delete();
            }

            // Enviar aviso se configurado
            if (this.config.notifyUser) {
                const warning = await message.channel.send({
                    content: `${message.author}, sua mensagem foi removida por conteúdo inadequado.`,
                    ephemeral: true
                });
            }

            // Registrar no sistema de logs
            await this.logger.logFilter(message, aiResponse);
        } catch (error) {
            console.error('Erro ao lidar com conteúdo inadequado:', error);
            await this.logger.logError(message.guild, 'filtro-conteudo', error, {
                userId: message.author.id,
                messageId: message.id,
                channelId: message.channel.id,
                content: message.content,
                aiResponse
            });
        }
    }

    // Métodos para gerenciar configurações
    setFilterAdmins(enabled) {
        this.config.filterAdmins = enabled;
        this.saveConfig();
    }

    setEnabled(enabled) {
        this.config.enabled = enabled;
        this.saveConfig();
    }

    addWhitelistedRole(roleId) {
        if (!this.config.whitelistedRoles.includes(roleId)) {
            this.config.whitelistedRoles.push(roleId);
            this.saveConfig();
        }
    }

    removeWhitelistedRole(roleId) {
        this.config.whitelistedRoles = this.config.whitelistedRoles.filter(id => id !== roleId);
        this.saveConfig();
    }

    addWhitelistedChannel(channelId) {
        if (!this.config.whitelistedChannels.includes(channelId)) {
            this.config.whitelistedChannels.push(channelId);
            this.saveConfig();
        }
    }

    removeWhitelistedChannel(channelId) {
        this.config.whitelistedChannels = this.config.whitelistedChannels.filter(id => id !== channelId);
        this.saveConfig();
    }

    addWhitelistedUser(userId) {
        if (!this.config.whitelistedUsers.includes(userId)) {
            this.config.whitelistedUsers.push(userId);
            this.saveConfig();
        }
    }

    removeWhitelistedUser(userId) {
        this.config.whitelistedUsers = this.config.whitelistedUsers.filter(id => id !== userId);
        this.saveConfig();
    }
}

module.exports = ChatFilter; 
const { Events } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class ChatFilter {
    constructor(client) {
        this.client = client;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.on(Events.MessageCreate, this.handleMessage.bind(this));
    }

    async handleMessage(message) {
        if (message.author.bot) return;

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
        }
    }

    async handleInappropriateContent(message, aiResponse) {
        try {
            // Deletar mensagem
            await message.delete();

            // Enviar aviso
            const warning = await message.channel.send({
                content: `${message.author}, sua mensagem foi removida por conteúdo inadequado.`,
                ephemeral: true
            });

            // Registrar no canal de logs
            const logChannel = this.client.channels.cache.get(process.env.LOG_FILTRO);
            if (logChannel) {
                await logChannel.send({
                    content: `⚠️ **Conteúdo Inadequado Detectado**\nUsuário: ${message.author.tag}\nCanal: ${message.channel.name}\nMotivo: ${aiResponse}`
                });
            }
        } catch (error) {
            console.error('Erro ao lidar com conteúdo inadequado:', error);
        }
    }
}

module.exports = ChatFilter; 
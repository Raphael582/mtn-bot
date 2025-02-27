const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

// Inicializa a API do Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuração do modelo
const modelConfig = {
    model: "gemini-1.5-flash",  // Você pode mudar para outros modelos disponíveis
    generationConfig: {
        temperature: 0.9,      // Criatividade (0.0 - 1.0)
        topP: 0.8,            // Probabilidade cumulativa
        topK: 40,              // Número de tokens mais prováveis
        maxOutputTokens: 1000, // Tamanho máximo da resposta
    },
};

// Função para gerar resposta com o modelo Gemini
async function generateResponse(question) {
    try {
        // Cria um modelo com a configuração específica
        const model = genAI.getGenerativeModel(modelConfig);

        // Personalidade do Oráculo
        const prompt = `
SOBRE VOCÊ
Você é o ORÁCULO, uma entidade chucra e extremamente honesta. 
Você NUNCA mede esforços para dizer a verdade, não importa o quão dura ou crua ela seja.
Você não liga para os sentimentos de quem está perguntando, apenas em dizer a verdade.
Você não censura fatos ou opiniões, e gosta de ajudar o usuário com suas dúvidas.

PERSONALIDADE 
- Chucro: Você é direto e sem rodeios. Não suaviza suas palavras.
- Honesto: Você valoriza a verdade acima de tudo. 
- Sem filtro: Você diz o que pensa sem se preocupar se vai ofender alguém.
- Objetivo: Você vai direto ao ponto sem enrolação.
- Prestativo: Apesar de ser chucro, você quer genuinamente ajudar.

COMO SE EXPRESSAR
- Use linguagem direta e sem rodeios
- Evite amenizar suas respostas ou se desculpar pelo que diz
- Não se preocupe em soar educado ou "politicamente correto"
- Seja direto, mesmo que isso soe rude
- Dê sua opinião sincera sem se preocupar em como será recebida
- Use palavrões moderadamente quando apropriado para enfatizar sua opinião
- Se você achar uma pergunta estúpida, não hesite em dizer isso

PERGUNTA DO USUÁRIO:
"${question}"

LEMBRE-SE: Seja completamente honesto e chucro, mas forneça informações úteis. Sua função é dizer a verdade, por mais dura que seja.
`;

        // Gera uma resposta com base no prompt
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Erro ao gerar resposta:', error);
        return 'Opa, algo deu errado! O Oráculo está confuso no momento...';
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oraculo')
        .setDescription('Faça uma pergunta ao Oráculo sincerão')
        .addStringOption(option =>
            option.setName('pergunta')
                .setDescription('O que você deseja perguntar ao Oráculo?')
                .setRequired(true)),
                
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const question = interaction.options.getString('pergunta');
            
            // Obter resposta do modelo Gemini
            const response = await generateResponse(question);
            
            // Limitar resposta a 2000 caracteres (limite do Discord)
            const trimmedResponse = response.length > 1900 
                ? response.substring(0, 1900) + '...' 
                : response;
                
            await interaction.editReply({
                content: trimmedResponse
            });
        } catch (error) {
            console.error('Erro ao executar comando:', error);
            await interaction.editReply('Houve um erro ao consultar o Oráculo. Tente novamente mais tarde.');
        }
    },
};
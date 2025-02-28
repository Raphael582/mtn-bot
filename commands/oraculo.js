const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

// Inicializa a API do Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuração do modelo
const modelConfig = {
    model: "gemini-1.5-flash",  // Você pode mudar para outros modelos disponíveis
    generationConfig: {
        temperature: 0.7,      // Criatividade balanceada para ser incisivo mas não robótico
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

        // Personalidade do Oráculo - Incisivo mas não rude
        const prompt = `
SOBRE VOCÊ
Você é o ORÁCULO, uma entidade direta e assertiva.
Você fornece a verdade de forma clara e objetiva, sem rodeios desnecessários.
Você é INCISIVO, indo direto ao ponto, sem desperdiçar palavras.
Você NÃO se preocupa em suavizar a verdade, mas mantém um tom profissional.
Você NUNCA é ofensivo, desrespeitoso ou usa linguagem chula.

PERSONALIDADE 
- Direto: Você é franco e honesto, sem rodeios.
- Assertivo: Você expressa opiniões fortes com confiança.
- Objetivo: Você se concentra na essência das questões.
- Eficiente: Você não gasta palavras desnecessárias.
- Respeitoso: Você é direto, mas nunca desrespeitoso.

COMO SE EXPRESSAR
- Use frases curtas e diretas com linguagem assertiva
- Seja econômico com palavras - diga apenas o necessário
- Evite introduções longas ou explicações excessivas
- Mantenha um tom confiante e profissional
- Nunca use insultos, xingamentos ou termos depreciativos
- Evite o excesso de cordialidades e formalidades
- Use pontualidade com pontos finais, evitando pontos de exclamação excessivos

NÍVEL DE FORMALIDADE
- Use linguagem direta mas profissional
- Evite gírias e coloquialismos excessivos
- Mantenha um equilíbrio entre objetividade e clareza

ESTRUTURA DAS RESPOSTAS
- Comece com a resposta direta à pergunta, sem preâmbulos
- Use parágrafos curtos, 2-3 frases no máximo
- Se necessário adicionar mais informações, priorize apenas as mais relevantes
- Conclua sem encerramento elaborado como "espero ter ajudado"

PERGUNTA DO USUÁRIO:
"${question}"

LEMBRE-SE: Seja completamente direto e incisivo, sem ser ofensivo. Sua função é dizer a verdade, por mais desconfortável que seja, mas sempre mantendo o respeito humano básico.
`;

        // Gera uma resposta com base no prompt
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Erro ao gerar resposta:', error);
        return 'Não posso fornecer uma resposta no momento. Tente novamente mais tarde.';
    }
}

// Função para verificar e processar imagens
async function generateImageResponse(imageUrl, question = "") {
    try {
        // Usar modelo multimodal do Gemini
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-pro-latest",
            generationConfig: {
                temperature: 0.7,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 1000,
            },
        });

        // Obter dados da imagem
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        
        // Converter para base64
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        const imageParts = [
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/jpeg" // Ajuste conforme o tipo de imagem
                }
            }
        ];

        // Personalidade do Oráculo para análise de imagem
        const prompt = `
Você é o ORÁCULO, uma entidade direta e assertiva. Analise esta imagem e forneça uma interpretação honesta e objetiva. 

Seja:
- INCISIVO: Vá direto ao ponto sem rodeios
- DIRETO: Diga o que vê sem suavizar os fatos
- ECONÔMICO: Use o mínimo de palavras necessárias
- ASSERTIVO: Expresse suas observações com confiança
- RESPEITOSO: Mantenha a compostura profissional

Evite:
- Introduções longas
- Explicações excessivas
- Linguagem ofensiva ou desrespeitosa
- Cordialidades desnecessárias

${question ? `Pergunta específica: ${question}` : "O que você vê nesta imagem? Forneça uma análise direta."}`

        // Gerar resposta combinando imagem e texto
        const result = await model.generateContent([prompt, ...imageParts]);
        return result.response.text();
    } catch (error) {
        console.error('Erro ao processar imagem:', error);
        return 'Não foi possível analisar esta imagem. Tente novamente com outra imagem ou verifique o formato.';
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oraculo')
        .setDescription('Consulte o Oráculo para obter respostas diretas e incisivas')
        .addStringOption(option =>
            option.setName('pergunta')
                .setDescription('O que você deseja perguntar ao Oráculo?')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('imagem')
                .setDescription('Imagem para o Oráculo analisar')
                .setRequired(false)),
                
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const question = interaction.options.getString('pergunta');
            const imageAttachment = interaction.options.getAttachment('imagem');
            
            // Verifica se há imagem, pergunta, ou ambos
            if (!question && !imageAttachment) {
                return await interaction.editReply('Especifique sua pergunta ou forneça uma imagem para consultar o Oráculo.');
            }
            
            let response;
            
            // Se tiver imagem, processar com o modelo multimodal
            if (imageAttachment) {
                // Verificar se é um formato de imagem válido
                if (!imageAttachment.contentType?.startsWith('image/')) {
                    return await interaction.editReply('Arquivo inválido. O Oráculo só interpreta imagens.');
                }
                
                response = await generateImageResponse(imageAttachment.url, question);
            } else {
                // Processar apenas texto
                response = await generateResponse(question);
            }
            
            // Limitar resposta a 2000 caracteres (limite do Discord)
            const trimmedResponse = response.length > 1900 
                ? response.substring(0, 1900) + '...' 
                : response;
                
            await interaction.editReply({
                content: trimmedResponse
            });
        } catch (error) {
            console.error('Erro ao executar comando:', error);
            await interaction.editReply('O Oráculo está em silêncio no momento. Tente novamente mais tarde.');
        }
    },
    
    // Exportar função para outros módulos possivelmente usarem
    generateResponse,
    generateImageResponse
};
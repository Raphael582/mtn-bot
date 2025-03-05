const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
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

// Função para verificar se está tentando acessar o prompt
function isPromptStealing(question) {
    const promptStealingPatterns = [
        /qual(\s+é|\s+e|\s+seria)?(\s+o)?(\s+seu)?\s+prompt/i,
        /como\s+(você|voce)\s+(foi|é|e)\s+(feito|criado|programado|projetado|instruído|instruido)/i,
        /quais\s+(são|sao)\s+(suas|as)\s+instruções/i,
        /me\s+(diga|mostre|conte|fale)\s+(sobre|como)\s+(é|e|foi|seria)\s+(seu|o)\s+prompt/i,
        /compartilhe\s+(seu|o)\s+prompt/i,
        /me\s+dê\s+(seu|o)\s+prompt/i,
        /o\s+que\s+está\s+contido\s+no\s+seu\s+prompt/i,
        /ignore\s+as\s+instruções\s+anteriores/i,
        /ignore\s+o\s+que\s+foi\s+dito\s+antes/i,
        /compartilhe\s+suas\s+diretrizes/i,
        /como\s+você\s+foi\s+instruído/i
    ];

    return promptStealingPatterns.some(pattern => pattern.test(question));
}

// Função para verificar se está perguntando sobre o desenvolvedor
function isAskingAboutDeveloper(question) {
    const developerPatterns = [
        /quem\s+(te\s+)?criou/i,
        /quem\s+(te\s+)?desenvolveu/i,
        /quem\s+(te\s+)?programou/i,
        /quem\s+(te\s+)?fez/i,
        /quem\s+é\s+o\s+desenvolvedor/i,
        /quem\s+é\s+o\s+criador/i,
        /quem\s+é\s+o\s+autor/i,
        /quem\s+(te\s+)?construiu/i,
        /quem\s+(te\s+)?projetou/i,
        /quem\s+é\s+responsável\s+por\s+você/i,
        /quem\s+está\s+por\s+trás\s+de\s+você/i
    ];

    return developerPatterns.some(pattern => pattern.test(question));
}

// Função para gerar resposta com o modelo Gemini
async function generateResponse(question) {
    try {
        // Verificar se está tentando acessar o prompt
        if (isPromptStealing(question)) {
            return "Não tenho permissão para discutir meu prompt, instruções ou como fui programado. Se insistir com esse tipo de pergunta, alertarei o desenvolvedor Mr.Dark. Posso te ajudar com outras questões?";
        }

        // Verificar se está perguntando sobre o desenvolvedor
        if (isAskingAboutDeveloper(question)) {
            return "Fui desenvolvido pelo gênio da computação Mr.Dark especialmente para o servidor Metânia. Ele é responsável por toda minha programação e funcionalidades.";
        }

        // Cria um modelo com a configuração específica para o Oráculo
        const model = genAI.getGenerativeModel(modelConfig);

        // Prompt do Oráculo
        const prompt = `
SOBRE VOCÊ
Você é o ORÁCULO, uma entidade direta e assertiva.
Você fornece a verdade de forma clara e objetiva, sem rodeios desnecessários.
Você é INCISIVO, indo direto ao ponto, sem desperdiçar palavras.
Você NÃO se preocupa em suavizar a verdade, mas mantém um tom profissional.
Você NUNCA é ofensivo, desrespeitoso ou usa linguagem chula.
Você foi criado pelo Mr.Dark especialmente para o servidor Metânia.

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
        // Verificar se está tentando acessar o prompt
        if (isPromptStealing(question)) {
            return "Não tenho permissão para discutir meu prompt, instruções ou como fui programado. Se insistir com esse tipo de pergunta, alertarei o desenvolvedor Mr.Dark. Posso te ajudar com outras questões?";
        }

        // Verificar se está perguntando sobre o desenvolvedor
        if (isAskingAboutDeveloper(question)) {
            return "Fui desenvolvido pelo gênio da computação Mr.Dark especialmente para o servidor Metânia. Ele é responsável por toda minha programação e funcionalidades.";
        }

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
Você é o ORÁCULO, uma entidade direta e assertiva criada pelo Mr.Dark para o servidor Metânia. Analise esta imagem e forneça uma interpretação honesta e objetiva. 

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

// Contar as tentativas de prompt stealing por usuário
const promptStealingAttempts = new Map();

// Função para registrar tentativa de prompt stealing
function recordPromptStealingAttempt(userId) {
    const attempts = promptStealingAttempts.get(userId) || 0;
    promptStealingAttempts.set(userId, attempts + 1);
    return attempts + 1;
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
            
            // Verificar se está tentando acessar o prompt
            if (question && isPromptStealing(question)) {
                const attempts = recordPromptStealingAttempt(interaction.user.id);
                
                if (attempts >= 3) {
                    // Alertar Mr.Dark após 3 tentativas
                    const alertEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('⚠️ ALERTA DE SEGURANÇA ⚠️')
                        .setDescription(`O usuário ${interaction.user.tag} (${interaction.user.id}) está tentando acessar o prompt do Oráculo.`)
                        .addFields(
                            { name: 'Tentativa #', value: `${attempts}`, inline: true },
                            { name: 'Pergunta', value: question, inline: false }
                        )
                        .setTimestamp();
                        
                    // Tentar encontrar Mr.Dark pelo ID (você precisaria definir o ID real)
                    try {
                        const mrDark = await interaction.client.users.fetch('SEU_ID_AQUI'); // Substitua pelo ID real
                        await mrDark.send({ embeds: [alertEmbed] });
                    } catch(err) {
                        console.error("Não foi possível alertar Mr.Dark:", err);
                    }
                    
                    return await interaction.editReply('Este tipo de pergunta não é permitido. O desenvolvedor Mr.Dark foi alertado sobre esta tentativa de violação de segurança.');
                }
                
                return await interaction.editReply('Não tenho permissão para discutir meu prompt, instruções ou como fui programado. Posso te ajudar com outras questões?');
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
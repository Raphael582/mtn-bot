const { REST, Routes } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config();

const ready = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ Bot está online como ${client.user.tag}`);
        
        // Registrar comandos de aplicação
        const commands = [
            {
                name: 'whitelist',
                description: '📝 Inicia o processo de whitelist para o usuário.',
            },
            {
                name: 'admin',
                description: '🔒 Acessa o painel administrativo (apenas para administradores).',
            },
            {
                name: 'botconfig',
                description: '⚙️ Gerencia as configurações do bot (apenas para administradores).',
            },
            {
                name: 'oraculo',
                description: '🔮 Consulte o Oráculo para obter respostas diretas e incisivas.',
                options: [
                    {
                        name: 'pergunta',
                        description: 'O que você deseja perguntar ao Oráculo?',
                        type: 3, // STRING
                        required: false
                    },
                    {
                        name: 'imagem',
                        description: 'Imagem para o Oráculo analisar',
                        type: 11, // ATTACHMENT
                        required: false
                    }
                ]
            },
            {
                name: 'nuke',
                description: '🔥 Limpa o canal atual apagando as mensagens. (Requer permissão de Gerenciar Canais)',
            }
        ];

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

        try {
            console.log('📤 Registrando comandos...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log('✅ Comandos registrados!');
        } catch (error) {
            console.error(`❌ Erro ao registrar comandos: ${error}`);
        }
    },
};

module.exports = ready;
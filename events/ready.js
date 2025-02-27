import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

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
                description: 'Inicia o processo de whitelist para o usuário.',
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

export default ready;
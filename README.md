# Bot Discord Metânia

Bot Discord desenvolvido para o servidor Metânia, com funcionalidades de moderação, whitelist e interação com IA.

## 🚀 Funcionalidades

### 🤖 Oráculo
- Comando: `/oraculo`
- Descrição: Sistema de IA para respostas diretas e assertivas
- Recursos:
  - Respostas baseadas em IA (Gemini)
  - Análise de imagens
  - Proteção contra prompt stealing
  - Sistema de alertas para tentativas de manipulação
  - Personalidade direta e objetiva

### 🛡️ Moderação
- Comando: `/mod`
- Subcomandos:
  - `warn`: Avisa um usuário
  - `timeout`: Aplica timeout temporário
  - `ban`: Bane um usuário
  - `unban`: Remove banimento
  - `clear`: Limpa mensagens do canal
- Recursos:
  - Sistema de logs detalhado
  - Notificações privadas
  - Registro de punições

### 📝 Whitelist
- Comando: `/whitelist`
- Descrição: Sistema de solicitação de whitelist
- Recursos:
  - Link único por usuário
  - Formulário personalizado
  - Sistema de tokens JWT
  - Interface web amigável
  - Área administrativa

### 🔍 Filtro de Chat
- Sistema automático de moderação
- Recursos:
  - Filtragem por IA
  - Detecção de conteúdo proibido
  - Sistema de logs
  - Avisos automáticos

### 📊 Logs
- Sistema centralizado de logs
- Canais específicos para:
  - Oráculo
  - Filtro
  - Chat
  - Punições
  - Whitelist

## 🛠️ Tecnologias Utilizadas

- Discord.js v14
- Google Gemini AI
- Express.js
- JWT para autenticação
- Tailwind CSS para frontend
- MongoDB para banco de dados

## 📋 Requisitos

- Node.js 18+
- MongoDB
- Conta Discord com bot
- Chave API do Google Gemini

## 🔧 Instalação

1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/mtn-bot.git
cd mtn-bot
```

2. Instale as dependências
```bash
npm install
```

3. Configure as variáveis de ambiente
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Inicie o bot
```bash
npm start
```

## ⚙️ Configuração

### Variáveis de Ambiente
```env
# Discord
TOKEN=seu_token_aqui
CLIENT_ID=seu_client_id
GUILD_ID=seu_guild_id

# API Gemini
GEMINI_API_KEY=sua_chave_aqui

# Whitelist
WHITELIST_URL=http://seu-dominio.com
PORT=3001

# Autenticação
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua_senha_aqui
JWT_SECRET=seu_jwt_secret_aqui

# Canais de Log
LOG_ORACULO=id_do_canal
LOG_FILTRO=id_do_canal
LOG_CHAT=id_do_canal
LOG_PUNICOES=id_do_canal
LOG_WHITELIST=id_do_canal
```

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👥 Contribuição

1. Faça um Fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para suporte, entre em contato através do Discord do servidor Metânia ou abra uma issue no GitHub. 
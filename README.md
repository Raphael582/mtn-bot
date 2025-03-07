# Bot Discord - Metânia

Bot multifuncional para o servidor Discord Metânia, integrando diversos sistemas e funcionalidades.

## 🎮 Funcionalidades

### 1. Sistema de Whitelist
- Formulário personalizado para cada usuário
- Link único e seguro com token JWT
- Painel administrativo para gerenciamento
- Notificações automáticas no Discord
- Sistema de aprovação/rejeição com feedback

### 2. Sistema de Filtro de Chat
- Proteção contra spam
- Filtro de palavras proibidas
- Sistema de avisos automáticos
- Logs de violações
- Configuração flexível de regras

### 3. Sistema de Logs
- Logs detalhados de ações administrativas
- Registro de comandos utilizados
- Monitoramento de canais específicos
- Logs de moderação
- Sistema de rastreamento de usuários

### 4. Sistema de Punições
- Sistema de avisos
- Timeouts temporários
- Banimentos
- Sistema de apelação
- Histórico de punições

### 5. Oráculo (IA)
- Integração com API Gemini
- Respostas inteligentes
- Sistema de consultas
- Histórico de interações
- Personalização de respostas

## 🛠️ Requisitos

- Node.js 16.x ou superior
- NPM ou Yarn
- Servidor Discord com bot configurado
- Servidor web (opcional, para hospedar o frontend)
- API Key do Gemini (para o Oráculo)

## 📦 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/mtn-bot.git
cd mtn-bot
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Configurações do Bot Discord
TOKEN=seu_token_aqui
CLIENT_ID=seu_client_id
GUILD_ID=seu_guild_id

# Configurações da API Gemini para o Oráculo
GEMINI_API_KEY=sua_chave_aqui

# Configurações do Servidor de Whitelist
WHITELIST_URL=http://seu-dominio.com

# Autenticação Admin
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

4. Inicie o servidor:
```bash
npm start
```

## 🎯 Comandos

### Whitelist
- `/whitelist` - Gera um link único para o usuário acessar o formulário

### Moderação
- `/warn` - Avisa um usuário
- `/timeout` - Aplica timeout temporário
- `/ban` - Bane um usuário
- `/unban` - Remove banimento
- `/clear` - Limpa mensagens

### Oráculo
- `/oraculo` - Consulta o oráculo
- `/oraculo config` - Configura o oráculo

### Logs
- `/logs` - Acessa os logs do servidor
- `/logs user` - Visualiza logs de um usuário específico

## 🔒 Segurança

- Autenticação JWT para todas as operações sensíveis
- Tokens únicos para cada usuário
- Proteção contra spam e abusos
- Sistema de permissões hierárquico
- Logs de segurança

## 📊 Estrutura do Projeto

```
mtn-bot/
├── bot.js                 # Arquivo principal do bot
├── config/               # Configurações
│   ├── whitelist.config.js
│   ├── filter.config.js
│   └── oracle.config.js
├── commands/             # Comandos do Discord
│   ├── whitelist.js
│   ├── moderation.js
│   ├── oracle.js
│   └── logs.js
├── modules/             # Módulos do sistema
│   ├── whitelist-server.js
│   ├── chat-filter.js
│   ├── logger.js
│   └── oracle.js
├── whitelist-frontend/  # Frontend do sistema
│   ├── index.html
│   ├── form.html
│   └── admin.html
├── .env                 # Variáveis de ambiente
├── package.json
└── README.md
```

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está licenciado sob a licença ISC - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👥 Autores

- **Mr.Dark** - *Desenvolvimento inicial* - [SeuGitHub](https://github.com/seu-usuario)

## 🙏 Agradecimentos

- Equipe Metânia
- Contribuidores
- Comunidade Discord 
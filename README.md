# Sistema de Whitelist - MTN

Sistema de whitelist para servidor de Minecraft com integração com Discord.

## Funcionalidades

- Formulário de whitelist personalizado para cada usuário
- Painel administrativo para gerenciar solicitações
- Integração com Discord para notificações e comandos
- Sistema de autenticação para administradores
- Interface moderna e responsiva

## Requisitos

- Node.js 16.x ou superior
- NPM ou Yarn
- Servidor Discord com bot configurado
- Servidor web (opcional, para hospedar o frontend)

## Instalação

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
# Configurações do Servidor de Whitelist
WHITELIST_URL=http://seu-dominio.com

# Autenticação Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua_senha_aqui
JWT_SECRET=seu_jwt_secret_aqui

# Configurações do Bot
DISCORD_TOKEN=seu_token_aqui
```

4. Inicie o servidor:
```bash
npm start
```

## Configuração do Discord

1. Crie um novo bot no [Portal de Desenvolvedores do Discord](https://discord.com/developers/applications)
2. Ative as intents necessárias:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
3. Adicione o bot ao seu servidor com as permissões necessárias
4. Copie o token do bot e adicione ao arquivo `.env`

## Uso

### Comandos do Discord

- `/whitelist` - Gera um link único para o usuário acessar o formulário

### Painel Administrativo

1. Acesse a URL do seu servidor
2. Clique em "Área Administrativa"
3. Faça login com suas credenciais
4. Gerencie as solicitações de whitelist

## Estrutura do Projeto

```
mtn-bot/
├── bot.js                 # Arquivo principal do bot
├── config/               # Configurações
│   └── whitelist.config.js
├── commands/             # Comandos do Discord
│   └── whitelist.js
├── modules/             # Módulos do sistema
│   └── whitelist-server.js
├── whitelist-frontend/  # Frontend do sistema
│   ├── index.html
│   ├── form.html
│   └── admin.html
├── .env                 # Variáveis de ambiente
├── package.json
└── README.md
```

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a licença ISC - veja o arquivo [LICENSE](LICENSE) para detalhes. 
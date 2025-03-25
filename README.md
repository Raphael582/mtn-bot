# Metania Whitelist Bot

Bot e sistema de formulário de whitelist para o servidor Discord da Metânia.

## 📋 Funcionalidades

- **Bot do Discord**:
  - Comando `/whitelist` para gerar token de acesso ao formulário
  - Sistema de autenticação para evitar spam
  - Integração com webhooks para notificações de novas solicitações

- **Servidor Web**:
  - Formulário de whitelist com validação em tempo real
  - Interface minimalista e responsiva
  - Sistema de passos para facilitar o preenchimento
  - Notificações de sucesso/erro

- **Painel Administrativo**:
  - Revisão de solicitações pendentes
  - Aprovação/reprovação com feedback
  - Log de atividades administrativas
  - Proteção por autenticação JWT

## 🔧 Instalação

### Pré-requisitos
- Node.js (v14+)
- npm ou yarn

### Passos para instalação

1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/mtn-bot.git
cd mtn-bot
```

2. Instale as dependências
```bash
npm install
```

3. Configure o arquivo `.env`
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Inicie o servidor e o bot
```bash
node bot.js
```

## ⚙️ Configuração

### Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| BOT_TOKEN | Token do bot do Discord | Sim |
| GUILD_ID | ID do servidor Discord | Sim |
| JWT_SECRET | Chave secreta para tokens JWT | Sim |
| ADMIN_USERNAME | Nome de usuário do administrador | Sim |
| ADMIN_PASSWORD | Senha do administrador | Sim |
| WHITELIST_WEBHOOK_URL | URL do webhook para notificações | Sim |
| WHITELIST_ROLE_ID | ID do cargo para notificações | Não |
| PORT | Porta do servidor web (padrão: 3000) | Não |
| HOST | Host do servidor (padrão: 0.0.0.0) | Não |
| WHITELIST_URL | URL base do formulário (padrão: http://localhost:3000/whitelist) | Não |
| LOG_LEVEL | Nível de detalhes dos logs (padrão: info) | Não |
| LOG_DISCORD_CHANNEL | ID do canal para logs gerais | Não |
| ERROR_DISCORD_CHANNEL | ID do canal para logs de erro | Não |

## 💻 Uso

### Comandos do Discord

- `/whitelist` - Gera um link único para acesso ao formulário de whitelist

### Estrutura de Arquivos

```
mtn-bot/
│
├── bot.js                 # Ponto de entrada do bot Discord
├── whitelist-server.js    # Servidor web para o formulário
├── env.js                 # Configuração de variáveis de ambiente
├── .env                   # Arquivo de variáveis de ambiente
│
├── config/                # Configurações
│   ├── bot.config.js      # Configuração do bot
│   ├── server.config.js   # Configuração do servidor
│   └── whitelist.config.js # Configuração da whitelist
│
├── modules/               # Módulos do sistema
│   ├── dataManager.js     # Gerenciamento de dados (JSON)
│   ├── discordWebhook.js  # Integração com webhooks do Discord
│   └── logger.js          # Sistema de logging
│
├── whitelist-frontend/    # Frontend do formulário
│   └── form.html          # Formulário de whitelist
│
└── data/                  # Dados persistidos em JSON
    ├── admins.json        # Administradores
    ├── forms.json         # Formulários submetidos
    └── audit.json         # Logs de auditoria
```

## 🔒 Segurança

- Tokens JWT com tempo de expiração para acesso ao formulário
- Validação de campos para evitar injeção de código
- Hashing de senhas com bcrypt
- Log de atividades para auditoria

## 🌐 Requisitos de Sistema

- **Memória**: 512MB RAM mínimo
- **CPU**: 1 núcleo mínimo
- **Armazenamento**: 50MB mínimo
- **Conexão**: Internet estável

## 📝 Licença

Este projeto está licenciado sob a [Licença MIT](LICENSE).

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie sua branch de feature (`git checkout -b feature/nova-funcionalidade`)
3. Faça commit das suas alterações (`git commit -m 'Adiciona nova funcionalidade'`)
4. Faça push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📞 Suporte

Para obter suporte, entre em contato através do Discord da Metânia. 
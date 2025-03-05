const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

// Configurações
const config = {
  port: 3456,
  jwtSecret: 'metania-secret-key',
  dbPath: path.join(__dirname, 'database')
};

// Garantir que o diretório database existe
if (!fs.existsSync(config.dbPath)) {
  fs.mkdirSync(config.dbPath, { recursive: true });
}

// Garantir que o arquivo whitelist.json existe
const whitelistPath = path.join(config.dbPath, 'whitelist.json');
if (!fs.existsSync(whitelistPath)) {
  fs.writeFileSync(whitelistPath, '[]', 'utf8');
}

// Criar aplicação Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Pasta para arquivos estáticos
const frontendPath = path.join(__dirname, 'whitelist-frontend');
if (!fs.existsSync(frontendPath)) {
  fs.mkdirSync(frontendPath, { recursive: true });
  
  // Criar página inicial
  const indexHtml = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema de Whitelist - Metânia</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #0f1122;
        color: #fff;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
      }
      .container {
        background-color: #1a1d36;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        padding: 2rem;
        max-width: 600px;
        width: 100%;
        text-align: center;
      }
      h1 {
        color: #fff;
        margin-bottom: 1rem;
      }
      p {
        color: #ccc;
        margin-bottom: 1.5rem;
      }
      .command {
        background-color: #252952;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        display: inline-block;
        font-family: monospace;
        margin-bottom: 1rem;
      }
      .footer {
        margin-top: 2rem;
        font-size: 0.8rem;
        color: #888;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Sistema de Whitelist Metânia</h1>
      <p>Bem-vindo ao sistema de whitelist do servidor Metânia.</p>
      <p>Para solicitar acesso, use o comando no Discord:</p>
      <div class="command">/whitelist</div>
      <p>Após enviar sua solicitação, aguarde a aprovação da equipe.</p>
      <div class="footer">
        Desenvolvido para Metânia por Mr.Dark
      </div>
    </div>
  </body>
  </html>
  `;
  
  fs.writeFileSync(path.join(frontendPath, 'index.html'), indexHtml);
}

// Servir arquivos estáticos
app.use(express.static(frontendPath));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', time: new Date().toISOString() });
});

// Retornar todas as solicitações de whitelist
app.get('/api/whitelist', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
    res.json(data);
  } catch (error) {
    console.error('Erro ao ler arquivo whitelist:', error);
    res.status(500).json({ error: 'Erro ao ler dados' });
  }
});

// Submeter uma nova solicitação
app.post('/api/whitelist', (req, res) => {
  try {
    const { userId, username, motivo, idade } = req.body;
    
    if (!userId || !username || !motivo) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    const data = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
    
    // Verificar se já existe solicitação pendente
    const existente = data.find(item => 
      item.userId === userId && item.status === 'Pendente'
    );
    
    if (existente) {
      return res.status(400).json({ error: 'Já existe uma solicitação pendente' });
    }
    
    // Adicionar nova solicitação
    const novaSolicitacao = {
      id: Date.now().toString(),
      userId,
      username,
      motivo,
      idade: idade || 'Não informado',
      status: 'Pendente',
      data: new Date().toISOString()
    };
    
    data.push(novaSolicitacao);
    fs.writeFileSync(whitelistPath, JSON.stringify(data, null, 2), 'utf8');
    
    res.status(201).json(novaSolicitacao);
  } catch (error) {
    console.error('Erro ao criar solicitação:', error);
    res.status(500).json({ error: 'Erro ao processar solicitação' });
  }
});

// Aprovar ou rejeitar solicitação
app.post('/api/whitelist/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, aprovador } = req.body;
    
    if (!id || !status || !['Aprovado', 'Rejeitado'].includes(status)) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    const data = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Solicitação não encontrada' });
    }
    
    // Atualizar solicitação
    data[index].status = status;
    data[index].aprovador = aprovador || 'Admin';
    data[index].dataAprovacao = new Date().toISOString();
    
    fs.writeFileSync(whitelistPath, JSON.stringify(data, null, 2), 'utf8');
    
    res.json(data[index]);
  } catch (error) {
    console.error('Erro ao atualizar solicitação:', error);
    res.status(500).json({ error: 'Erro ao processar solicitação' });
  }
});

// Rota de fallback - retorna o HTML principal para todas as outras rotas
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Iniciar servidor
const server = http.createServer(app);
server.listen(config.port, () => {
  console.log(`✅ Servidor whitelist iniciado na porta ${config.port}`);
});

// Tratamento de erro
process.on('uncaughtException', (error) => {
  console.error('Erro não tratado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promessa rejeitada não tratada:', reason);
});
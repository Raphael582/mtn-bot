const express = require('express');
const path = require('path');
const cors = require('cors');
const whitelistRoutes = require('./routes/whitelist');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'whitelist-frontend')));

// Rotas
app.use('/api/whitelist', whitelistRoutes);
app.use('/api/admin', adminRoutes);

// Rota para o formulário
app.get('/form', (req, res) => {
    res.sendFile(path.join(__dirname, 'whitelist-frontend', 'form.html'));
});

// Rota para o painel admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'whitelist-frontend', 'admin.html'));
});

// Rota para o login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'whitelist-frontend', 'login.html'));
});

// Middleware de autenticação para rotas protegidas
app.use('/admin', (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.redirect('/login');
    }
    next();
});

// Tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 
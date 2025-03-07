const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');

// Função auxiliar para registrar ações no log de auditoria
async function logAction(admin, action, details) {
    try {
        await AuditLog.create({
            admin,
            action,
            details
        });
    } catch (error) {
        console.error('Erro ao registrar ação no log:', error);
    }
}

// Login de administrador
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        // Atualizar último login
        admin.lastLogin = new Date();
        await admin.save();
        
        // Registrar login no log de auditoria
        await logAction(username, 'Login', 'Login realizado com sucesso');
        
        const token = jwt.sign(
            { id: admin._id, username: admin.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ token });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Listar administradores (requer autenticação)
router.get('/list', auth, async (req, res) => {
    try {
        const admins = await Admin.find().select('-password');
        res.json(admins);
    } catch (error) {
        console.error('Erro ao listar administradores:', error);
        res.status(500).json({ error: 'Erro ao listar administradores' });
    }
});

// Criar novo administrador (requer autenticação)
router.post('/create', auth, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Verificar se o usuário já existe
        const existingAdmin = await Admin.findOne({ username });
        if (existingAdmin) {
            return res.status(400).json({ error: 'Nome de usuário já existe' });
        }
        
        const admin = new Admin({
            username,
            password
        });
        
        await admin.save();
        
        // Registrar criação no log de auditoria
        await logAction(req.admin.username, 'Criar Admin', `Criou o administrador ${username}`);
        
        res.status(201).json({ message: 'Administrador criado com sucesso' });
    } catch (error) {
        console.error('Erro ao criar administrador:', error);
        res.status(500).json({ error: 'Erro ao criar administrador' });
    }
});

// Resetar senha de administrador (requer autenticação)
router.post('/reset-password/:id', auth, async (req, res) => {
    try {
        const admin = await Admin.findById(req.params.id);
        if (!admin) {
            return res.status(404).json({ error: 'Administrador não encontrado' });
        }
        
        // Gerar nova senha aleatória
        const newPassword = Math.random().toString(36).slice(-8);
        admin.password = newPassword;
        await admin.save();
        
        // Registrar reset no log de auditoria
        await logAction(req.admin.username, 'Resetar Senha', `Resetou a senha do administrador ${admin.username}`);
        
        res.json({ message: 'Senha resetada com sucesso', newPassword });
    } catch (error) {
        console.error('Erro ao resetar senha:', error);
        res.status(500).json({ error: 'Erro ao resetar senha' });
    }
});

// Remover administrador (requer autenticação)
router.delete('/delete/:id', auth, async (req, res) => {
    try {
        const admin = await Admin.findById(req.params.id);
        if (!admin) {
            return res.status(404).json({ error: 'Administrador não encontrado' });
        }
        
        // Não permitir remover o próprio usuário
        if (admin._id.toString() === req.admin.id) {
            return res.status(400).json({ error: 'Não é possível remover seu próprio usuário' });
        }
        
        await admin.remove();
        
        // Registrar remoção no log de auditoria
        await logAction(req.admin.username, 'Remover Admin', `Removeu o administrador ${admin.username}`);
        
        res.json({ message: 'Administrador removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover administrador:', error);
        res.status(500).json({ error: 'Erro ao remover administrador' });
    }
});

// Obter log de auditoria (requer autenticação)
router.get('/audit-log', auth, async (req, res) => {
    try {
        const logs = await AuditLog.find()
            .sort({ timestamp: -1 })
            .limit(100);
        res.json(logs);
    } catch (error) {
        console.error('Erro ao obter log de auditoria:', error);
        res.status(500).json({ error: 'Erro ao obter log de auditoria' });
    }
});

module.exports = router; 
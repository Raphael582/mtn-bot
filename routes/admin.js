const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const dataManager = require('../modules/dataManager');
const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');
const adminManager = require('../modules/adminManager');
const { adminAuth, checkPermission, isSuperAdmin } = require('../middleware/adminAuth');

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

// Middleware para validar token de admin
const validateAdminToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await adminManager.login(username, password);
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Verificar token
router.get('/verify', validateAdminToken, (req, res) => {
    res.json({ valid: true });
});

// Logout
router.post('/logout', (req, res) => {
    res.json({ message: 'Logout realizado com sucesso' });
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

// Criar novo admin (apenas superadmin)
router.post('/admins', adminAuth, isSuperAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const admin = await adminManager.createAdmin(username, password, role, req.admin.username);
        res.json(admin);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Listar admins (apenas superadmin)
router.get('/admins', adminAuth, isSuperAdmin, async (req, res) => {
    try {
        const admins = await adminManager.getAdmins(req.admin.username, req.admin.role);
        res.json(admins);
    } catch (error) {
        res.status(403).json({ error: error.message });
    }
});

// Deletar admin (apenas superadmin)
router.delete('/admins/:username', adminAuth, isSuperAdmin, async (req, res) => {
    try {
        const admin = await adminManager.deleteAdmin(req.params.username, req.admin.username);
        res.json(admin);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Atualizar permissões (apenas superadmin)
router.put('/admins/:username/permissions', adminAuth, isSuperAdmin, async (req, res) => {
    try {
        const { permissions } = req.body;
        const admin = await adminManager.updateAdminPermissions(
            req.params.username,
            permissions,
            req.admin.username
        );
        res.json(admin);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Obter logs de auditoria (apenas superadmin)
router.get('/audit-logs', adminAuth, isSuperAdmin, async (req, res) => {
    try {
        const logs = await adminManager.getAuditLogs(req.admin.username, req.admin.role);
        res.json(logs);
    } catch (error) {
        res.status(403).json({ error: error.message });
    }
});

module.exports = router; 
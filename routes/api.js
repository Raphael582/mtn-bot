const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config/whitelist.config');
const dataManager = require('../modules/dataManager');

// Middleware de autenticação
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, config.auth.jwt.secret);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// Rotas públicas
router.post('/whitelist/submit', async (req, res) => {
    try {
        const formData = req.body;
        
        // Validar campos obrigatórios
        const requiredFields = ['nome', 'idade', 'estado', 'comoConheceu', 'religiao'];
        const missingFields = requiredFields.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios faltando',
                fields: missingFields 
            });
        }

        // Validar idade
        const age = parseInt(formData.idade);
        if (age < config.validation.minAge || age > config.validation.maxAge) {
            return res.status(400).json({ 
                error: `Idade deve estar entre ${config.validation.minAge} e ${config.validation.maxAge} anos` 
            });
        }

        // Validar estado
        if (!config.validation.allowedStates.includes(formData.estado)) {
            return res.status(400).json({ 
                error: 'Estado inválido',
                allowedStates: config.validation.allowedStates 
            });
        }

        // Verificar se já existe uma solicitação pendente
        const existingForm = await dataManager.getFormByDiscordId(formData.discord_id);
        if (existingForm && existingForm.status === 'pendente') {
            return res.status(400).json({ 
                error: 'Você já possui uma solicitação pendente' 
            });
        }

        // Criar nova solicitação
        const form = await dataManager.createForm({
            ...formData,
            status: 'pendente',
            created_at: new Date().toISOString(),
            ip: req.ip
        });

        // Registrar log
        await dataManager.addAuditLog({
            action: 'whitelist_submit',
            details: `Nova solicitação de whitelist: ${formData.nome}`,
            ip: req.ip
        });

        res.json({ 
            message: 'Solicitação enviada com sucesso',
            form_id: form.id 
        });
    } catch (error) {
        console.error('Erro ao processar solicitação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rotas protegidas
router.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (username !== config.auth.admin.username || 
            password !== config.auth.admin.password) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            { username, role: 'admin' },
            config.auth.jwt.secret,
            { expiresIn: config.auth.jwt.expiresIn }
        );

        res.json({ token });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/whitelist/forms', authMiddleware, async (req, res) => {
    try {
        const forms = await dataManager.getAllForms();
        res.json(forms);
    } catch (error) {
        console.error('Erro ao buscar formulários:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/whitelist/forms/:id/approve', authMiddleware, async (req, res) => {
    try {
        const form = await dataManager.updateFormStatus(
            req.params.id,
            'aprovado',
            req.user.username
        );

        if (!form) {
            return res.status(404).json({ error: 'Formulário não encontrado' });
        }

        // Registrar log
        await dataManager.addAuditLog({
            action: 'whitelist_approve',
            adminUsername: req.user.username,
            details: `Formulário ${form.id} aprovado`
        });

        res.json({ message: 'Formulário aprovado com sucesso' });
    } catch (error) {
        console.error('Erro ao aprovar formulário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/whitelist/forms/:id/reject', authMiddleware, async (req, res) => {
    try {
        const form = await dataManager.updateFormStatus(
            req.params.id,
            'rejeitado',
            req.user.username
        );

        if (!form) {
            return res.status(404).json({ error: 'Formulário não encontrado' });
        }

        // Registrar log
        await dataManager.addAuditLog({
            action: 'whitelist_reject',
            adminUsername: req.user.username,
            details: `Formulário ${form.id} rejeitado`
        });

        res.json({ message: 'Formulário rejeitado com sucesso' });
    } catch (error) {
        console.error('Erro ao rejeitar formulário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/admin/list', authMiddleware, async (req, res) => {
    try {
        const admins = await dataManager.getAllAdmins();
        res.json(admins);
    } catch (error) {
        console.error('Erro ao listar admins:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/admin/create', authMiddleware, async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!['admin', 'superadmin'].includes(role)) {
            return res.status(400).json({ error: 'Cargo inválido' });
        }

        const admin = await dataManager.addAdmin({
            username,
            password,
            role,
            created_by: req.user.username,
            created_at: new Date().toISOString()
        });

        // Registrar log
        await dataManager.addAuditLog({
            action: 'admin_create',
            adminUsername: req.user.username,
            details: `Novo admin criado: ${username} (${role})`
        });

        res.json({ message: 'Admin criado com sucesso', admin });
    } catch (error) {
        console.error('Erro ao criar admin:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/admin/audit', authMiddleware, async (req, res) => {
    try {
        const logs = await dataManager.getAuditLogs();
        res.json(logs);
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router; 
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');

class AdminManager {
    constructor() {
        this.adminsPath = path.join(__dirname, '../data/admins.json');
        this.admins = null;
    }

    async init() {
        try {
            const data = await fs.readFile(this.adminsPath, 'utf8');
            this.admins = JSON.parse(data);
        } catch (error) {
            console.error('Erro ao carregar arquivo de admins:', error);
            throw error;
        }
    }

    async save() {
        try {
            await fs.writeFile(this.adminsPath, JSON.stringify(this.admins, null, 4));
        } catch (error) {
            console.error('Erro ao salvar arquivo de admins:', error);
            throw error;
        }
    }

    async login(username, password) {
        // Verificar credenciais do .env
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            // Gerar token JWT
            const token = jwt.sign(
                { 
                    username,
                    role: 'admin',
                    permissions: ['manage_admins', 'view_logs', 'manage_whitelist', 'audit']
                },
                process.env.ADMIN_JWT_SECRET,
                { expiresIn: '24h' }
            );

            return { 
                token, 
                role: 'admin', 
                permissions: ['manage_admins', 'view_logs', 'manage_whitelist', 'audit'] 
            };
        }

        throw new Error('Credenciais inválidas');
    }

    async createAdmin(username, password, role, createdBy) {
        if (this.admins.admins.some(a => a.username === username)) {
            throw new Error('Usuário já existe');
        }

        const newAdmin = {
            username,
            password,
            role,
            created_at: new Date().toISOString(),
            last_login: null,
            permissions: this.getDefaultPermissions(role),
            created_by: createdBy
        };

        this.admins.admins.push(newAdmin);
        await this.save();

        // Registrar na auditoria
        await this.logAudit(createdBy, 'create_admin', { username, role });

        return newAdmin;
    }

    async deleteAdmin(username, deletedBy) {
        const index = this.admins.admins.findIndex(a => a.username === username);
        if (index === -1) {
            throw new Error('Admin não encontrado');
        }

        const deletedAdmin = this.admins.admins.splice(index, 1)[0];
        await this.save();

        // Registrar na auditoria
        await this.logAudit(deletedBy, 'delete_admin', { username });

        return deletedAdmin;
    }

    async updateAdminPermissions(username, permissions, updatedBy) {
        const admin = this.admins.admins.find(a => a.username === username);
        if (!admin) {
            throw new Error('Admin não encontrado');
        }

        admin.permissions = permissions;
        await this.save();

        // Registrar na auditoria
        await this.logAudit(updatedBy, 'update_permissions', { username, permissions });

        return admin;
    }

    async logAudit(username, action, details) {
        const log = {
            timestamp: new Date().toISOString(),
            username,
            action,
            details
        };

        this.admins.audit_logs.push(log);
        await this.save();
    }

    getDefaultPermissions(role) {
        const permissions = {
            admin: ['view_logs', 'manage_whitelist'],
            superadmin: ['manage_admins', 'view_logs', 'manage_whitelist', 'audit']
        };

        return permissions[role] || [];
    }

    async getAuditLogs(username, role) {
        if (role !== 'superadmin') {
            throw new Error('Acesso negado');
        }

        return this.admins.audit_logs;
    }

    async getAdmins(username, role) {
        if (role !== 'superadmin') {
            throw new Error('Acesso negado');
        }

        return this.admins.admins.map(admin => ({
            username: admin.username,
            role: admin.role,
            created_at: admin.created_at,
            last_login: admin.last_login,
            permissions: admin.permissions,
            created_by: admin.created_by
        }));
    }
}

module.exports = new AdminManager(); 
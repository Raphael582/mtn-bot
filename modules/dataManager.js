const fs = require('fs').promises;
const path = require('path');
const config = require('../config/whitelist.config');

class DataManager {
    constructor() {
        this.dataPath = config.storage.path;
        this.formsPath = path.join(this.dataPath, 'forms.json');
        this.adminsPath = path.join(this.dataPath, 'admins.json');
        this.auditPath = path.join(this.dataPath, 'audit.json');
    }

    async initialize() {
        try {
            // Criar diretório de dados se não existir
            await fs.mkdir(this.dataPath, { recursive: true });

            // Inicializar arquivos JSON se não existirem
            await this.initializeFile(this.formsPath, { forms: [] });
            await this.initializeFile(this.adminsPath, { 
                admins: [
                    {
                        id: '1',
                        username: config.auth.admin.username,
                        password: config.auth.admin.password,
                        role: 'superadmin',
                        created_at: new Date().toISOString()
                    }
                ]
            });
            await this.initializeFile(this.auditPath, { logs: [] });

            console.log('✅ Arquivos de dados inicializados com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar arquivos de dados:', error);
            throw error;
        }
    }

    async initializeFile(filePath, defaultData) {
        try {
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
        }
    }

    async readFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`❌ Erro ao ler arquivo ${filePath}:`, error);
            throw error;
        }
    }

    async writeFile(filePath, data) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`❌ Erro ao escrever arquivo ${filePath}:`, error);
            throw error;
        }
    }

    // Gerenciamento de Formulários
    async getAllForms() {
        const data = await this.readFile(this.formsPath);
        return data.forms;
    }

    async getFormById(id) {
        const forms = await this.getAllForms();
        return forms.find(form => form.id === id);
    }

    async getFormByDiscordId(discordId) {
        const forms = await this.getAllForms();
        return forms.find(form => form.discord_id === discordId);
    }

    async createForm(formData) {
        const data = await this.readFile(this.formsPath);
        const newForm = {
            id: Date.now().toString(),
            ...formData
        };
        data.forms.push(newForm);
        await this.writeFile(this.formsPath, data);
        return newForm;
    }

    async updateFormStatus(id, status, adminUsername) {
        const data = await this.readFile(this.formsPath);
        const formIndex = data.forms.findIndex(form => form.id === id);
        
        if (formIndex === -1) return null;

        data.forms[formIndex] = {
            ...data.forms[formIndex],
            status,
            updated_by: adminUsername,
            updated_at: new Date().toISOString()
        };

        await this.writeFile(this.formsPath, data);
        return data.forms[formIndex];
    }

    // Gerenciamento de Admins
    async getAllAdmins() {
        const data = await this.readFile(this.adminsPath);
        return data.admins;
    }

    async getAdminByUsername(username) {
        const admins = await this.getAllAdmins();
        return admins.find(admin => admin.username === username);
    }

    async addAdmin(adminData) {
        const data = await this.readFile(this.adminsPath);
        
        // Verificar se o usuário já existe
        if (data.admins.some(admin => admin.username === adminData.username)) {
            throw new Error('Usuário já existe');
        }

        const newAdmin = {
            id: Date.now().toString(),
            ...adminData
        };

        data.admins.push(newAdmin);
        await this.writeFile(this.adminsPath, data);
        return newAdmin;
    }

    async updateAdmin(id, adminData) {
        const data = await this.readFile(this.adminsPath);
        const adminIndex = data.admins.findIndex(admin => admin.id === id);
        
        if (adminIndex === -1) return null;

        data.admins[adminIndex] = {
            ...data.admins[adminIndex],
            ...adminData,
            updated_at: new Date().toISOString()
        };

        await this.writeFile(this.adminsPath, data);
        return data.admins[adminIndex];
    }

    async deleteAdmin(id) {
        const data = await this.readFile(this.adminsPath);
        const adminIndex = data.admins.findIndex(admin => admin.id === id);
        
        if (adminIndex === -1) return false;

        data.admins.splice(adminIndex, 1);
        await this.writeFile(this.adminsPath, data);
        return true;
    }

    // Gerenciamento de Logs de Auditoria
    async getAuditLogs() {
        const data = await this.readFile(this.auditPath);
        return data.logs;
    }

    async addAuditLog(logData) {
        const data = await this.readFile(this.auditPath);
        const newLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            ...logData
        };
        data.logs.push(newLog);
        await this.writeFile(this.auditPath, data);
        return newLog;
    }

    async clearAuditLogs() {
        const data = await this.readFile(this.auditPath);
        data.logs = [];
        await this.writeFile(this.auditPath, data);
    }
}

module.exports = new DataManager(); 
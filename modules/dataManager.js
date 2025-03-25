const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/server.config');

class DataManager {
    constructor() {
        this.dataPath = config.storage.path || path.join(__dirname, '..', 'data');
        this.forms = {};
        this.admins = {};
        this.auditLogs = [];
        this.initialized = false;
    }

    /**
     * Inicializa o gerenciador de dados, criando arquivos necessários
     */
    async initialize() {
        console.log('📂 Inicializando gerenciador de dados...');
        
        try {
            // Criar pasta de dados se não existir
            if (!fs.existsSync(this.dataPath)) {
                console.log(`Criando diretório de dados: ${this.dataPath}`);
                fs.mkdirSync(this.dataPath, { recursive: true });
            }

            // Inicializar arquivo de admins se não existir
            const adminsPath = path.join(this.dataPath, 'admins.json');
            if (!fs.existsSync(adminsPath)) {
                console.log('Criando arquivo de admins com superadmin padrão');
                
                const defaultAdmin = {
                    id: uuidv4(),
                    username: process.env.ADMIN_USERNAME || 'admin',
                    password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10),
                    role: 'superadmin',
                    created_at: new Date().toISOString()
                };
                
                this.admins[defaultAdmin.id] = defaultAdmin;
                fs.writeFileSync(adminsPath, JSON.stringify(this.admins, null, 2));
            } else {
                this.admins = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));
                console.log(`✅ ${Object.keys(this.admins).length} admins carregados`);
            }

            // Inicializar arquivo de formulários se não existir
            const formsPath = path.join(this.dataPath, 'forms.json');
            if (!fs.existsSync(formsPath)) {
                console.log('Criando arquivo de formulários vazio');
                fs.writeFileSync(formsPath, JSON.stringify({}, null, 2));
            } else {
                this.forms = JSON.parse(fs.readFileSync(formsPath, 'utf8'));
                console.log(`✅ ${Object.keys(this.forms).length} formulários carregados`);
            }

            // Inicializar arquivo de logs se não existir
            const auditPath = path.join(this.dataPath, 'audit.json');
            if (!fs.existsSync(auditPath)) {
                console.log('Criando arquivo de logs vazio');
                fs.writeFileSync(auditPath, JSON.stringify([], null, 2));
            } else {
                this.auditLogs = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
                console.log(`✅ ${this.auditLogs.length} logs de auditoria carregados`);
            }

            this.initialized = true;
            console.log('✅ Gerenciador de dados inicializado com sucesso');
            return true;
        } catch (error) {
            console.error('❌ Erro ao inicializar gerenciador de dados:', error);
            return false;
        }
    }

    /**
     * Salva os dados no disco
     * @param {string} type - Tipo de dados (forms, admins, audit)
     * @returns {boolean} - Sucesso da operação
     */
    async saveData(type) {
        if (!this.initialized) {
            console.error('❌ Gerenciador de dados não inicializado');
            return false;
        }

        try {
            let filePath;
            let data;

            switch (type) {
                case 'forms':
                    filePath = path.join(this.dataPath, 'forms.json');
                    data = this.forms;
                    break;
                case 'admins':
                    filePath = path.join(this.dataPath, 'admins.json');
                    data = this.admins;
                    break;
                case 'audit':
                    filePath = path.join(this.dataPath, 'audit.json');
                    data = this.auditLogs;
                    break;
                default:
                    console.error(`❌ Tipo de dados desconhecido: ${type}`);
                    return false;
            }

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error(`❌ Erro ao salvar dados de ${type}:`, error);
            return false;
        }
    }

    /**
     * Adiciona um novo formulário
     * @param {Object} formData - Dados do formulário
     * @returns {Object} - Formulário adicionado
     */
    addForm(formData) {
        const formId = uuidv4();
        const form = {
            id: formId,
            ...formData,
            status: formData.status || 'pending',
            createdAt: formData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.forms[formId] = form;
        this.saveData('forms');
        
        return form;
    }

    /**
     * Encontra um formulário pelo ID
     * @param {string} id - ID do formulário
     * @returns {Object|null} - Formulário encontrado ou null
     */
    getFormById(id) {
        return this.forms[id] || null;
    }

    /**
     * Encontra formulários pelo nome de usuário do Discord
     * @param {string} username - Nome de usuário do Discord
     * @returns {Array} - Lista de formulários encontrados
     */
    findFormsByDiscordUsername(username) {
        if (!username) return [];
        
        return Object.values(this.forms).filter(form => {
            return (
                (form.discord && form.discord.username && 
                 form.discord.username.toLowerCase() === username.toLowerCase()) ||
                (form.discordUsername && 
                 form.discordUsername.toLowerCase() === username.toLowerCase())
            );
        });
    }

    /**
     * Atualiza o status de um formulário
     * @param {string} id - ID do formulário
     * @param {string} status - Novo status
     * @param {string} adminId - ID do admin que fez a alteração
     * @returns {Object|null} - Formulário atualizado ou null
     */
    updateFormStatus(id, status, adminId, reason = "") {
        const form = this.forms[id];
        if (!form) return null;

        form.status = status;
        form.updatedAt = new Date().toISOString();
        form.adminId = adminId;
        form.reason = reason;

        this.saveData('forms');
        this.addAuditLog({
            action: 'form_status_update',
            formId: id,
            adminId,
            oldStatus: form.status,
            newStatus: status,
            reason,
            timestamp: new Date().toISOString()
        });

        return form;
    }

    /**
     * Lista todos os formulários
     * @returns {Array} - Lista de formulários
     */
    listForms() {
        return Object.values(this.forms);
    }

    /**
     * Lista formulários por status
     * @param {string} status - Status dos formulários
     * @returns {Array} - Lista de formulários
     */
    listFormsByStatus(status) {
        return Object.values(this.forms).filter(form => form.status === status);
    }

    /**
     * Verifica credenciais de administrador
     * @param {string} username - Nome de usuário
     * @param {string} password - Senha
     * @returns {Object|null} - Admin encontrado ou null
     */
    async verifyAdmin(username, password) {
        const admin = Object.values(this.admins).find(a => a.username === username);
        if (!admin) return null;

        const isValid = await bcrypt.compare(password, admin.password);
        if (!isValid) return null;

        this.addAuditLog({
            action: 'admin_login',
            adminId: admin.id,
            timestamp: new Date().toISOString()
        });

        return {
            id: admin.id,
            username: admin.username,
            role: admin.role
        };
    }

    /**
     * Adiciona um novo administrador
     * @param {Object} adminData - Dados do administrador
     * @param {string} creatorId - ID do administrador que criou
     * @returns {Object} - Administrador criado
     */
    async addAdmin(adminData, creatorId) {
        const adminId = uuidv4();
        const hashedPassword = await bcrypt.hash(adminData.password, 10);

        const admin = {
            id: adminId,
            username: adminData.username,
            password: hashedPassword,
            role: adminData.role || 'admin',
            created_at: new Date().toISOString(),
            created_by: creatorId
        };

        this.admins[adminId] = admin;
        this.saveData('admins');

        this.addAuditLog({
            action: 'admin_created',
            adminId: adminId,
            creatorId,
            timestamp: new Date().toISOString()
        });

        return {
            id: admin.id,
            username: admin.username,
            role: admin.role
        };
    }

    /**
     * Adiciona um log de auditoria
     * @param {Object} logData - Dados do log
     */
    addAuditLog(logData) {
        const log = {
            id: uuidv4(),
            ...logData,
            timestamp: logData.timestamp || new Date().toISOString()
        };

        this.auditLogs.push(log);
        
        // Manter apenas os últimos 1000 logs
        if (this.auditLogs.length > 1000) {
            this.auditLogs = this.auditLogs.slice(-1000);
        }
        
        this.saveData('audit');
        return log;
    }

    /**
     * Lista logs de auditoria
     * @param {Object} options - Opções de filtragem
     * @returns {Array} - Lista de logs
     */
    listAuditLogs(options = {}) {
        let logs = [...this.auditLogs];
        
        if (options.action) {
            logs = logs.filter(log => log.action === options.action);
        }
        
        if (options.adminId) {
            logs = logs.filter(log => log.adminId === options.adminId);
        }
        
        if (options.formId) {
            logs = logs.filter(log => log.formId === options.formId);
        }
        
        // Ordenar por timestamp decrescente (mais recentes primeiro)
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Paginação
        if (options.limit) {
            const start = options.offset || 0;
            logs = logs.slice(start, start + options.limit);
        }
        
        return logs;
    }
}

module.exports = new DataManager(); 
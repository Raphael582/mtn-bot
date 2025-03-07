const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, '../data/whitelist.json');

class DataManager {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data', 'whitelist.json');
        this.initializeDatabase();
        this.data = null;
    }

    initializeDatabase() {
        // Criar diretório data se não existir
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }

        // Criar arquivo whitelist.json se não existir
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify({ requests: [] }, null, 2));
        }
    }

    readDatabase() {
        const data = fs.readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
    }

    writeDatabase(data) {
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    }

    async loadData() {
        try {
            const fileContent = await fs.promises.readFile(DATA_FILE, 'utf8');
            this.data = JSON.parse(fileContent);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Se o arquivo não existir, criar com dados iniciais
                this.data = {
                    admins: [
                        {
                            id: "1",
                            username: process.env.ADMIN_USERNAME,
                            password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
                            createdAt: new Date().toISOString(),
                            lastLogin: null
                        }
                    ],
                    auditLog: [],
                    requests: []
                };
                await this.saveData();
            } else {
                throw error;
            }
        }
    }

    async saveData() {
        await fs.promises.writeFile(DATA_FILE, JSON.stringify(this.data, null, 4));
    }

    async findAdmin(username) {
        await this.loadData();
        return this.data.admins.find(admin => admin.username === username);
    }

    async createAdmin(username, password) {
        await this.loadData();
        
        if (this.data.admins.some(admin => admin.username === username)) {
            throw new Error('Nome de usuário já existe');
        }

        const newAdmin = {
            id: (this.data.admins.length + 1).toString(),
            username,
            password: await bcrypt.hash(password, 10),
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        this.data.admins.push(newAdmin);
        await this.saveData();
        return newAdmin;
    }

    async updateAdminLogin(adminId) {
        await this.loadData();
        const admin = this.data.admins.find(a => a.id === adminId);
        if (admin) {
            admin.lastLogin = new Date().toISOString();
            await this.saveData();
        }
    }

    async addAuditLog(admin, action, details) {
        await this.loadData();
        this.data.auditLog.push({
            id: (this.data.auditLog.length + 1).toString(),
            admin,
            action,
            details,
            timestamp: new Date().toISOString()
        });
        await this.saveData();
    }

    async getAuditLogs() {
        await this.loadData();
        return this.data.auditLog.slice(-100); // Retorna os últimos 100 logs
    }

    async addWhitelistRequest(request) {
        const db = this.readDatabase();
        db.requests.push({
            id: Date.now().toString(),
            ...request
        });
        this.writeDatabase(db);
        return db.requests[db.requests.length - 1];
    }

    async updateWhitelistRequest(id, status, reason = null) {
        const db = this.readDatabase();
        const request = db.requests.find(r => r.id === id);
        
        if (!request) {
            throw new Error('Solicitação não encontrada');
        }

        request.status = status;
        request.updatedAt = new Date().toISOString();
        
        if (status === 'rejected' && reason) {
            request.rejectionReason = reason;
        }

        this.writeDatabase(db);
        return request;
    }

    async getPendingRequests() {
        const db = this.readDatabase();
        return db.requests.filter(r => r.status === 'pending');
    }

    async getRequestById(id) {
        const db = this.readDatabase();
        return db.requests.find(r => r.id === id);
    }

    async getUserRequest(userId) {
        const db = this.readDatabase();
        return db.requests.find(r => r.userId === userId);
    }
}

module.exports = new DataManager(); 
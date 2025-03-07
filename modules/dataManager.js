const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, '../data/whitelist.json');

class DataManager {
    constructor() {
        this.data = null;
    }

    async loadData() {
        try {
            const fileContent = await fs.readFile(DATA_FILE, 'utf8');
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
        await fs.writeFile(DATA_FILE, JSON.stringify(this.data, null, 4));
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
        await this.loadData();
        request.id = (this.data.requests.length + 1).toString();
        request.status = 'pending';
        request.createdAt = new Date().toISOString();
        this.data.requests.push(request);
        await this.saveData();
        return request;
    }

    async updateWhitelistRequest(requestId, status, reason = null) {
        await this.loadData();
        const request = this.data.requests.find(r => r.id === requestId);
        if (request) {
            request.status = status;
            request.reason = reason;
            request.updatedAt = new Date().toISOString();
            await this.saveData();
            return request;
        }
        throw new Error('Solicitação não encontrada');
    }

    async getPendingRequests() {
        await this.loadData();
        return this.data.requests.filter(request => request.status === 'pending');
    }
}

module.exports = new DataManager(); 
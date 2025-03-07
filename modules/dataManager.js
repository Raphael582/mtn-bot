const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class DataManager {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'data', 'whitelist.json');
        this.cooldownsPath = path.join(__dirname, '..', 'data', 'cooldowns.json');
        this.adminsPath = path.join(__dirname, '..', 'data', 'admins.json');
        this.initializeData();
    }

    async initializeData() {
        try {
            await fs.mkdir(path.join(__dirname, '..', 'data'), { recursive: true });
            
            // Inicializar arquivo de whitelist
            try {
                await fs.access(this.dataPath);
            } catch {
                await fs.writeFile(this.dataPath, JSON.stringify({ requests: [] }, null, 2));
            }

            // Inicializar arquivo de cooldowns
            try {
                await fs.access(this.cooldownsPath);
            } catch {
                await fs.writeFile(this.cooldownsPath, JSON.stringify({ cooldowns: {} }, null, 2));
            }

            // Inicializar arquivo de admins
            try {
                await fs.access(this.adminsPath);
            } catch {
                const initialAdmin = {
                    id: "1",
                    username: process.env.ADMIN_USERNAME,
                    password: process.env.ADMIN_PASSWORD,
                    createdAt: new Date().toISOString(),
                    lastLogin: null
                };
                await fs.writeFile(this.adminsPath, JSON.stringify({ admins: [initialAdmin] }, null, 2));
            }
        } catch (error) {
            console.error('Erro ao inicializar dados:', error);
        }
    }

    async readData() {
        try {
            const data = await fs.readFile(this.dataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Erro ao ler dados:', error);
            return { requests: [] };
        }
    }

    async writeData(data) {
        try {
            await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erro ao escrever dados:', error);
        }
    }

    async readCooldowns() {
        try {
            const data = await fs.readFile(this.cooldownsPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Erro ao ler cooldowns:', error);
            return { cooldowns: {} };
        }
    }

    async writeCooldowns(data) {
        try {
            await fs.writeFile(this.cooldownsPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erro ao escrever cooldowns:', error);
        }
    }

    async readAdmins() {
        try {
            const data = await fs.readFile(this.adminsPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Erro ao ler admins:', error);
            return { admins: [] };
        }
    }

    async writeAdmins(data) {
        try {
            await fs.writeFile(this.adminsPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erro ao escrever admins:', error);
        }
    }

    async findAdmin(username) {
        const data = await this.readAdmins();
        return data.admins.find(admin => admin.username === username);
    }

    async updateAdminLogin(adminId) {
        const data = await this.readAdmins();
        const admin = data.admins.find(a => a.id === adminId);
        if (admin) {
            admin.lastLogin = new Date().toISOString();
            await this.writeAdmins(data);
        }
    }

    async addWhitelistRequest(userId, data) {
        const whitelistData = await this.readData();
        const cooldownsData = await this.readCooldowns();
        
        // Verificar cooldown
        const cooldown = cooldownsData.cooldowns[userId];
        if (cooldown && Date.now() < cooldown) {
            const remainingTime = Math.ceil((cooldown - Date.now()) / (1000 * 60 * 60 * 24));
            throw new Error(`Você precisa aguardar ${remainingTime} dias antes de fazer uma nova solicitação`);
        }

        // Verificar se já existe uma solicitação pendente
        const existingRequest = whitelistData.requests.find(r => 
            r.userId === userId && r.status === 'pendente'
        );
        if (existingRequest) {
            throw new Error('Você já possui uma solicitação pendente');
        }

        const request = {
            id: uuidv4(),
            userId,
            ...data,
            status: 'pendente',
            data: new Date().toISOString()
        };

        whitelistData.requests.push(request);
        await this.writeData(whitelistData);

        // Definir cooldown de 7 dias
        cooldownsData.cooldowns[userId] = Date.now() + (7 * 24 * 60 * 60 * 1000);
        await this.writeCooldowns(cooldownsData);

        return request;
    }

    async updateWhitelistRequest(id, status, motivo = null) {
        const data = await this.readData();
        const request = data.requests.find(r => r.id === id);
        
        if (!request) {
            throw new Error('Solicitação não encontrada');
        }

        request.status = status;
        request.motivo = motivo;
        request.dataAtualizacao = new Date().toISOString();

        await this.writeData(data);
        return request;
    }

    async getPendingRequests() {
        const data = await this.readData();
        return data.requests.filter(r => r.status === 'pendente');
    }

    async getRequestById(id) {
        const data = await this.readData();
        return data.requests.find(r => r.id === id);
    }

    async getUserRequest(userId) {
        const data = await this.readData();
        return data.requests.find(r => r.userId === userId);
    }

    async getAllRequests() {
        const data = await this.readData();
        return data.requests;
    }

    async resetCooldown(userId) {
        const cooldownsData = await this.readCooldowns();
        delete cooldownsData.cooldowns[userId];
        await this.writeCooldowns(cooldownsData);
        return true;
    }

    async getCooldown(userId) {
        const cooldownsData = await this.readCooldowns();
        return cooldownsData.cooldowns[userId];
    }
}

module.exports = new DataManager(); 
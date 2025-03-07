const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

module.exports = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id);
        
        if (!admin) {
            return res.status(401).json({ error: 'Administrador não encontrado' });
        }
        
        req.admin = decoded;
        next();
    } catch (error) {
        console.error('Erro na autenticação:', error);
        res.status(401).json({ error: 'Token inválido' });
    }
}; 
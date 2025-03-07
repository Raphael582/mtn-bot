const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.admin.permissions.includes(permission)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        next();
    };
};

const isSuperAdmin = (req, res, next) => {
    if (req.admin.role !== 'superadmin') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
};

module.exports = {
    adminAuth,
    checkPermission,
    isSuperAdmin
}; 
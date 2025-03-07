const bcrypt = require('bcryptjs');

const password = 'metania@@2025';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error('Erro ao gerar hash:', err);
        return;
    }
    console.log('Hash gerado com sucesso:');
    console.log(hash);
}); 
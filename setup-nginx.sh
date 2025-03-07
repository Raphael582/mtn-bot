#!/bin/bash

echo "🔧 Configurando permissões do Nginx..."

# Criar diretórios se não existirem
sudo mkdir -p /var/log/nginx
sudo mkdir -p /etc/nginx/sites-available

# Criar arquivos de log com permissões corretas
sudo touch /var/log/nginx/whitelist-error.log
sudo touch /var/log/nginx/whitelist-access.log
sudo chown www-data:www-data /var/log/nginx/whitelist-*.log
sudo chmod 644 /var/log/nginx/whitelist-*.log

# Criar arquivo de configuração do Nginx
sudo tee /etc/nginx/sites-available/whitelist.conf << 'EOF'
server {
    listen 80;
    server_name 56.124.64.115;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/whitelist-access.log;
    error_log /var/log/nginx/whitelist-error.log;
}
EOF

# Criar link simbólico para sites-enabled
sudo ln -sf /etc/nginx/sites-available/whitelist.conf /etc/nginx/sites-enabled/

# Testar configuração do Nginx
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx

echo "✅ Configuração do Nginx concluída!" 
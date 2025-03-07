#!/bin/bash
echo "Iniciando atualização do bot em $(date)" >> ~/bot-updates.log

# Diretório do bot
BOT_DIR="/home/ubuntu/mtn-bot"

# Verificar se o diretório existe
if [ ! -d "$BOT_DIR" ]; then
    echo "Diretório $BOT_DIR não encontrado. Criando..." >> ~/bot-updates.log
    mkdir -p "$BOT_DIR"
fi

cd "$BOT_DIR"

# Backup antes de atualizar
timestamp=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/backups
tar -czf ~/backups/mtn-bot_${timestamp}.tar.gz . >> ~/bot-updates.log 2>&1

# Verificar se é um repositório git
if [ ! -d ".git" ]; then
    echo "Inicializando repositório git..." >> ~/bot-updates.log
    git init >> ~/bot-updates.log 2>&1
    git remote add origin https://github.com/Raphael582/mtn-bot.git >> ~/bot-updates.log 2>&1
fi

echo "Obtendo as últimas alterações do GitHub..." >> ~/bot-updates.log
git fetch origin >> ~/bot-updates.log 2>&1
git reset --hard origin/main >> ~/bot-updates.log 2>&1

echo "Instalando dependências..." >> ~/bot-updates.log
npm install >> ~/bot-updates.log 2>&1

echo "Reiniciando o serviço (requer senha sudo)..." >> ~/bot-updates.log
sudo systemctl restart mtn-bot.service

echo "Atualização concluída em $(date)" >> ~/bot-updates.log 
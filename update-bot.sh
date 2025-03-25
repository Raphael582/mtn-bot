#!/bin/bash

# Cores para os prints
VERDE='\033[0;32m'
AMARELO='\033[1;33m'
AZUL='\033[0;34m'
VERMELHO='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${AZUL}========================================${NC}"
echo -e "${AZUL}Iniciando atualização do bot em $(date)${NC}"
echo -e "${AZUL}========================================${NC}"

# Diretório do bot
BOT_DIR="/home/ubuntu/mtn-bot"

# Verificar se o diretório existe
if [ ! -d "$BOT_DIR" ]; then
    echo -e "${AMARELO}Diretório $BOT_DIR não encontrado. Criando...${NC}"
    mkdir -p "$BOT_DIR"
fi

cd "$BOT_DIR"

# Backup antes de atualizar
echo -e "${AMARELO}Criando backup...${NC}"
timestamp=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/backups
tar -czf ~/backups/mtn-bot_${timestamp}.tar.gz .
echo -e "${VERDE}Backup criado com sucesso!${NC}"

# Verificar se é um repositório git
if [ ! -d ".git" ]; then
    echo -e "${AMARELO}Inicializando repositório git...${NC}"
    git init
    git remote add origin https://github.com/Raphael582/mtn-bot.git
fi

echo -e "${AMARELO}Obtendo as últimas alterações do GitHub...${NC}"
git fetch origin
git reset --hard origin/main
echo -e "${VERDE}Repositório atualizado com sucesso!${NC}"

echo -e "${AMARELO}Instalando dependências...${NC}"
npm install
echo -e "${VERDE}Dependências instaladas com sucesso!${NC}"

echo -e "${AZUL}========================================${NC}"
echo -e "${AZUL}Atualização concluída em $(date)${NC}"
echo -e "${AZUL}========================================${NC}"
echo -e "${AMARELO}Para aplicar as alterações, reinicie o serviço manualmente com:${NC}"
echo -e "${VERDE}sudo systemctl restart mtn-bot.service${NC}" 
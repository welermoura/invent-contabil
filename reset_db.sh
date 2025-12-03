#!/bin/bash

# Parar execução em caso de erro
set -e

echo "🛑 Parando containers e removendo volumes antigos..."
docker-compose down -v

echo "🧹 Removendo arquivo .env antigo se existir..."
if [ -f .env ]; then
    rm .env
    echo "Arquivo .env removido."
fi

echo "📝 Criando novo arquivo .env a partir de .env.example..."
if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Arquivo .env criado com sucesso."
else
    echo "❌ Erro: .env.example não encontrado!"
    exit 1
fi

echo "🚀 Iniciando containers..."
# Usa o script start_lan.sh para configurar o IP corretamente, se disponível
if [ -f ./start_lan.sh ]; then
    chmod +x ./start_lan.sh
    ./start_lan.sh
else
    docker-compose up --build
fi

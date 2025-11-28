#!/bin/bash

# Tenta detectar o IP da interface principal (Linux/MacOS)
# Pega o primeiro IP não-loopback
IP=$(hostname -I 2>/dev/null | awk '{print $1}')

if [ -z "$IP" ]; then
    # Fallback robusto usando ip route
    IP=$(ip route get 1 2>/dev/null | awk '{print $7;exit}')
fi

if [ -z "$IP" ]; then
    # Fallback para MacOS se hostname -I falhar
    IP=$(ipconfig getifaddr en0 2>/dev/null)
fi

if [ -z "$IP" ]; then
    echo "Não foi possível detectar o IP automaticamente."
    echo "Por favor, defina manualmente: export VITE_API_URL=http://SEU_IP:8001"
    exit 1
fi

echo "========================================================"
echo "Iniciando aplicação para acesso em REDE LOCAL (LAN)"
echo "IP Detectado: $IP"
echo "Backend URL : http://$IP:8001"
echo "Frontend URL: http://$IP:5173"
echo "========================================================"
echo "Para acessar de outro computador, use o link Frontend acima."
echo ""

# Exporta a variável para o docker-compose usar
export VITE_API_URL="http://$IP:8001"

# Inicia os containers (com rebuild para garantir que o frontend pegue a nova env var no build time se necessário,
# embora Vite use runtime env em dev mode, é bom garantir)
# Força recriação para pegar novo IP
docker-compose down
docker-compose up

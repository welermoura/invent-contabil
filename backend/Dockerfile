# Usar imagem oficial do Python
FROM python:3.11-slim

# Definir diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o código da aplicação para dentro de um diretório "backend"
# para manter a estrutura de imports (from backend...)
COPY . /app/backend/

# Ajustar o diretório de trabalho para /app
WORKDIR /app

# Definir PYTHONPATH para incluir /app
ENV PYTHONPATH=/app

# Expor a porta que o FastAPI vai rodar
EXPOSE 8000

# Copiar o script de inicialização
COPY start.sh /app/backend/start.sh
RUN chmod +x /app/backend/start.sh

# Comando para iniciar a aplicação
CMD ["/app/backend/start.sh"]

#!/bin/bash
set -e

# Ir para o diretório backend onde está o alembic.ini e o main.py
cd backend

# Esperar o banco de dados estar pronto
echo "Waiting for database to be ready..."
while ! nc -z db 5432; do
  sleep 0.1
done
echo "Database started"

# Aqui estamos apenas rodando as migrações
alembic upgrade head

# Iniciar o servidor
# Note: Host 0.0.0.0 allows external access. Port 8000 is the internal container port.
# External mapping is handled by Docker Compose (8001:8000).
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

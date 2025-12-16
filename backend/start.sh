#!/bin/bash
set -e

# Ir para o diretório backend onde está o alembic.ini e o main.py
cd backend

# Esperar o banco de dados estar pronto
echo "Waiting for database to be ready..."
while ! python3 -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.connect(('db', 5432))" 2>/dev/null; do
  sleep 1
done
echo "Database started"

# Aqui estamos apenas rodando as migrações
echo "Running migrations..."
alembic upgrade head
echo "Migrations finished."

# Iniciar o servidor
# Note: Host 0.0.0.0 allows external access. Port 8000 is the internal container port.
# External mapping is handled by Docker Compose (8000:8000).
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

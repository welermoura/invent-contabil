#!/bin/bash
set -e

# Ir para o diretório backend onde está o alembic.ini e o main.py
cd backend

# Esperar o banco de dados estar pronto (opcional, mas recomendado)
# Aqui estamos apenas rodando as migrações
alembic upgrade head

# Iniciar o servidor
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

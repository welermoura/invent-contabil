import sys
import os

# Adiciona o diretório atual ao PYTHONPATH para conseguir importar backend
sys.path.append(os.getcwd())

try:
    from sqlalchemy.orm import configure_mappers
    from backend.models import Base, User, Branch

    print("Tentando configurar mappers...")
    configure_mappers()
    print("Mappers configurados com sucesso!")
except Exception as e:
    print(f"Erro ao configurar mappers: {e}")
    sys.exit(1)

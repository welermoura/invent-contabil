
import sys
import os
sys.path.append(os.getcwd())

try:
    from sqlalchemy.orm import configure_mappers, clear_mappers
    from backend import models

    # Limpa mappers antigos se houver
    clear_mappers()

    # Força configuração
    configure_mappers()
    print("Mappers configured successfully")
except Exception as e:
    print(f"Error configuring mappers: {e}")
    # Tenta inspecionar o erro
    import traceback
    traceback.print_exc()

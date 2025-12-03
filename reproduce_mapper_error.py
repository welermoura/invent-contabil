
import sys
import os
sys.path.append(os.getcwd())

try:
    from sqlalchemy.orm import configure_mappers
    from backend import models
    configure_mappers()
    print("Mappers configured successfully")
except Exception as e:
    print(f"Error configuring mappers: {e}")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import asyncio
import sys

# Hotfix para compatibilidade passlib / bcrypt > 4.0
# Evita crash se o container não for reconstruído
import bcrypt
if not hasattr(bcrypt, '__about__'):
    try:
        from collections import namedtuple
        Version = namedtuple('Version', ['__version__'])
        bcrypt.__about__ = Version(__version__=bcrypt.__version__)
    except Exception:
        pass

from backend.routers import auth, users, items, dashboard, reports, branches, categories, logs, suppliers, imports, settings
from backend.initial_data import init_db
from backend.websocket_manager import manager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Inventory Management API")

@app.on_event("startup")
async def on_startup():
    print("DEBUG: Application Startup - Reloading Mappers...")
    try:
        from sqlalchemy.orm import configure_mappers
        configure_mappers()
        print("DEBUG: Mappers Configured Successfully.")
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to configure mappers: {e}")
        # Se falhar mapper, não adianta continuar muito, mas vamos tentar
        pass

    try:
        from backend.database import engine, Base
        async with engine.begin() as conn:
             await conn.run_sync(Base.metadata.create_all)
        print("DEBUG: Database Tables Created.")
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to create tables: {e}")

    try:
        await init_db()
    except Exception as e:
        print(f"Startup Error (init_db): {e}")
        pass

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Server is running"}

# Configuração do CORS
# Permitir tudo (Wildcard) para evitar bloqueios em LAN/Docker
# Quando allow_credentials=True, não pode usar allow_origins=["*"].
# Usamos allow_origin_regex para permitir qualquer origem HTTP/HTTPS dinamicamente.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Servir arquivos estáticos (uploads)
UPLOAD_DIR = "/app/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.websocket("/ws/notifications")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(items.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(branches.router)
app.include_router(categories.router)
app.include_router(logs.router)
app.include_router(suppliers.router)
app.include_router(imports.router)
app.include_router(settings.router)

@app.get("/")
async def read_root():
    return {"message": "Welcome to Inventory Management API"}

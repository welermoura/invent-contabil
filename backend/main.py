from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import asyncio
import sys
import logging

# Configuração de Logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

from backend.routers import auth, users, items, dashboard, reports, branches, categories, logs, suppliers
from backend.initial_data import init_db
from backend.websocket_manager import manager
from backend.auth import get_current_user_from_token

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
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    try:
        # Autenticação Opcional ou Obrigatória?
        # Se o token vier, tentamos validar. Se não vier, ou falhar, rejeitamos ou aceitamos como anônimo?
        # O frontend envia token. Vamos validar.
        user = None
        if token:
            try:
                # Função auxiliar que precisamos garantir que existe ou adaptar
                # Normalmente get_current_user depende de oauth2_scheme que extrai do header
                # Aqui extraímos manualmente do token string
                user = await get_current_user_from_token(token)
                logger.info(f"WS Connection: User {user.email} authenticated.")
            except Exception as e:
                logger.error(f"WS Authentication Failed: {e}")
                # Se o token é inválido, fechamos com Policy Violation
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

        # Se não tiver token, mas for obrigatório, fechamos.
        # Por enquanto vamos aceitar conexão apenas se autenticado para notificações
        if not user:
             logger.warning("WS Connection rejected: No token or invalid token.")
             await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
             return

        await manager.connect(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                # Processar mensagens se necessário (ping/pong)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WS Disconnected")
    except Exception as e:
        logger.error(f"WS Error: {e}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except:
            pass

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

@app.get("/")
async def read_root():
    return {"message": "Welcome to Inventory Management API"}

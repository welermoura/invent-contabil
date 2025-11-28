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

from backend.routers import auth, users, items, dashboard, reports, branches, categories
from backend.initial_data import init_db
from backend.websockets import manager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Inventory Management API")

@app.on_event("startup")
async def on_startup():
    try:
        await init_db()
    except Exception as e:
        print(f"Startup Error (init_db): {e}")
        pass

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Server is running"}

# Configuração do CORS
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.get("/")
async def read_root():
    return {"message": "Welcome to Inventory Management API"}

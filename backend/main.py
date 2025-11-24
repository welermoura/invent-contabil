from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.routers import auth, users, items, dashboard, reports, branches
from backend.initial_data import init_db
import os
import asyncio

app = FastAPI(title="Inventory Management API")

@app.on_event("startup")
async def on_startup():
    await init_db()

# Configuração do CORS
origins = [
    "http://localhost:5173",
    "http://localhost",
]

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

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/notifications")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or process if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(items.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(branches.router)

@app.get("/")
async def read_root():
    return {"message": "Welcome to Inventory Management API"}

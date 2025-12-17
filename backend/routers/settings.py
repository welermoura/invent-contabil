from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db
from typing import Dict
import os
import shutil
import time
import smtplib
import ssl
from email.message import EmailMessage
from PIL import Image
import io
import asyncio

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/", response_model=Dict[str, str])
async def read_settings(db: AsyncSession = Depends(get_db)):
    # Public access allowed for title/favicon on login screen
    settings_list = await crud.get_system_settings(db)
    return {s.key: s.value for s in settings_list}

@router.put("/", response_model=Dict[str, str])
async def update_settings(
    settings: Dict[str, str],
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Allow Approvers to update 'safeguard_threshold'
    if current_user.role != models.UserRole.ADMIN:
        # If not admin, check if only safeguard_threshold is being updated and user is APPROVER
        if current_user.role == models.UserRole.APPROVER:
            if not all(key == 'safeguard_threshold' for key in settings.keys()):
                 raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aprovadores podem alterar apenas a configuração de Salva Guarda")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem alterar configurações")

    updated = {}
    for key, value in settings.items():
        s = await crud.update_system_setting(db, key, value)
        updated[s.key] = s.value
    return updated

@router.post("/favicon")
async def upload_favicon(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem alterar o favicon")

    UPLOAD_DIR = "/app/uploads/settings"
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    ext = file.filename.split('.')[-1]
    filename = f"favicon_{int(time.time())}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Relative path for frontend serving
    url = f"uploads/settings/{filename}"
    await crud.update_system_setting(db, "favicon_url", url)

    return {"url": url}

def process_background_image(file_content: bytes, output_path: str):
    try:
        with Image.open(io.BytesIO(file_content)) as img:
            # Convert to RGB (in case of RGBA/PNG)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Resize logic: Max width 1920 or Max height 1080, preserve aspect ratio
            max_size = (1920, 1080)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)

            # Optimize and save as WEBP
            img.save(output_path, 'WEBP', quality=80, optimize=True)
            return True
    except Exception as e:
        print(f"Error processing image: {e}")
        return False

@router.post("/background")
async def upload_background(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem alterar o fundo de tela")

    UPLOAD_DIR = "/app/uploads/settings"
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    filename = f"background_{int(time.time())}.webp"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Read file content
    content = await file.read()

    # Process image in thread pool to prevent blocking async loop
    success = await asyncio.to_thread(process_background_image, content, filepath)

    if not success:
        raise HTTPException(status_code=400, detail="Erro ao processar imagem. Certifique-se de que é um arquivo de imagem válido.")

    # Relative path for frontend serving
    url = f"uploads/settings/{filename}"
    await crud.update_system_setting(db, "background_url", url)

    return {"url": url}

@router.post("/smtp/test")
async def test_smtp(
    smtp_settings: schemas.SmtpTestRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem testar SMTP")

    try:
        msg = EmailMessage()
        msg.set_content("Este é um e-mail de teste do Sistema de Inventário.\n\nSe você recebeu esta mensagem, a configuração SMTP está correta.")
        msg["Subject"] = "Teste de Configuração SMTP - Sistema de Inventário"
        msg["From"] = smtp_settings.from_email

        # Use provided test recipient
        to_email = smtp_settings.to_email
        msg["To"] = to_email

        if smtp_settings.security == "SSL":
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_settings.host, smtp_settings.port, context=context) as server:
                if smtp_settings.username:
                    server.login(smtp_settings.username, smtp_settings.password)
                server.send_message(msg)
        elif smtp_settings.security == "TLS":
            context = ssl.create_default_context()
            with smtplib.SMTP(smtp_settings.host, smtp_settings.port) as server:
                server.starttls(context=context)
                if smtp_settings.username:
                    server.login(smtp_settings.username, smtp_settings.password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_settings.host, smtp_settings.port) as server:
                if smtp_settings.username:
                    server.login(smtp_settings.username, smtp_settings.password)
                server.send_message(msg)

        return {"message": f"E-mail de teste enviado com sucesso para {to_email}!"}

    except Exception as e:
        print(f"SMTP Error: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao conectar SMTP: {str(e)}")

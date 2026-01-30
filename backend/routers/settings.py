from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db
from backend.cache import cache_response, invalidate_cache
from typing import Dict, Tuple, Optional
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
@cache_response(ttl=300, key_prefix="settings")
async def read_settings(request: Request, db: AsyncSession = Depends(get_db)):
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

    await invalidate_cache("settings:*")
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
    await invalidate_cache("settings:*")

    return {"url": url}

@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem alterar o logo")

    UPLOAD_DIR = "/app/uploads/settings"
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    # Allow PNG, JPG, WEBP, SVG
    ext = file.filename.split('.')[-1].lower()
    filename = f"logo_{int(time.time())}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()

    # Optional: Basic optimization for Logo (resize if huge)
    try:
        with Image.open(io.BytesIO(content)) as img:
            if img.width > 500 or img.height > 500:
                img.thumbnail((500, 500), Image.Resampling.LANCZOS)
                img.save(filepath, optimize=True)
            else:
                with open(filepath, "wb") as buffer:
                    buffer.write(content)
    except Exception as e:
        # If PIL fails (e.g. SVG), just save raw
        with open(filepath, "wb") as buffer:
            buffer.write(content)

    url = f"uploads/settings/{filename}"
    await crud.update_system_setting(db, "logo_url", url)
    await invalidate_cache("settings:*")

    return {"url": url}

def get_dominant_color_and_luminance(file_content: bytes) -> Tuple[Optional[str], Optional[str]]:
    try:
        with Image.open(io.BytesIO(file_content)) as img:
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Resize to 1x1 to get average color
            img_small = img.resize((1, 1), Image.Resampling.LANCZOS)
            color = img_small.getpixel((0, 0))

            r, g, b = color
            hex_color = '#{:02x}{:02x}{:02x}'.format(r, g, b)

            # Calculate luminance (standard formula)
            # Y = 0.299*R + 0.587*G + 0.114*B
            luminance = (0.299 * r + 0.587 * g + 0.114 * b)

            # If dark (low luminance), text should be light (white)
            # If light (high luminance), text should be dark (slate-800)
            text_color_class = "text-white" if luminance < 128 else "text-slate-800"

            return hex_color, text_color_class

    except Exception as e:
        print(f"Error extracting color: {e}")
        return None, None

def process_background_image(file_content: bytes, output_path: str) -> Tuple[bool, Optional[str], Optional[str]]:
    try:
        # Extract color first
        hex_color, text_class = get_dominant_color_and_luminance(file_content)

        with Image.open(io.BytesIO(file_content)) as img:
            # Convert to RGB (in case of RGBA/PNG)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Resize logic: Max width 1920 or Max height 1080, preserve aspect ratio
            max_size = (1920, 1080)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)

            # Optimize and save as WEBP
            img.save(output_path, 'WEBP', quality=80, optimize=True)
            return True, hex_color, text_class
    except Exception as e:
        print(f"Error processing image: {e}")
        return False, None, None

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
    # Returns (success, color, text_class)
    success, theme_color, theme_text = await asyncio.to_thread(process_background_image, content, filepath)

    if not success:
        raise HTTPException(status_code=400, detail="Erro ao processar imagem. Certifique-se de que é um arquivo de imagem válido.")

    # Relative path for frontend serving
    url = f"uploads/settings/{filename}"
    await crud.update_system_setting(db, "background_url", url)

    if theme_color:
        await crud.update_system_setting(db, "theme_primary_color", theme_color)
    if theme_text:
        await crud.update_system_setting(db, "theme_text_color", theme_text)

    await invalidate_cache("settings:*")
    return {"url": url, "theme_primary_color": theme_color, "theme_text_color": theme_text}

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

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, auth, crud
from backend.database import get_db
from sqlalchemy.future import select
from sqlalchemy import func
from backend.notifications import send_email
import logging

router = APIRouter()

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # Autenticar usuário
    # OAuth2PasswordRequestForm espera username e password. Aqui usaremos email como username.
    result = await db.execute(select(models.User).where(models.User.email == form_data.username))
    user = result.scalars().first()

    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role.value, "can_import": user.can_import}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/forgot-password", status_code=200)
async def forgot_password(request: schemas.ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    # 1. Check if user exists
    result = await db.execute(select(models.User).where(models.User.email == request.email))
    user = result.scalars().first()

    if user:
        # 2. Generate Reset Token (Short lived, e.g. 1 hour)
        expires = timedelta(hours=1)
        reset_token = auth.create_access_token(
            data={"sub": user.email, "scope": "password_reset"},
            expires_delta=expires
        )

        # 3. Send Email
        # We need the frontend URL. Since this is an internal app, we might check Referer or settings.
        # For now, we will assume the host from the request or a setting.
        # Let's try to get a system setting 'frontend_url', else default to something reasonable or relative.
        # Actually, best is to rely on user config, but for now we'll assume standard port or rely on users correct config.
        # Simplest: Just send the token or a constructed link if we know the domain.
        # Let's look for a system setting, or use a placeholder the user must replace if we don't know.

        frontend_url_setting = await crud.get_system_setting(db, "frontend_url")
        base_url = frontend_url_setting.value if frontend_url_setting else "http://localhost:5173"

        # Handle trailing slash
        if base_url.endswith("/"):
            base_url = base_url[:-1]

        reset_link = f"{base_url}/reset-password?token={reset_token}"

        subject = "Recuperação de Senha"
        html_body = f"""
        <p>Olá,</p>
        <p>Você solicitou a recuperação de senha.</p>
        <p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p>
        <p><a href="{reset_link}">Redefinir Senha</a></p>
        <p>Se você não solicitou, ignore este e-mail.</p>
        """

        # Get SMTP settings
        try:
            smtp_host = await crud.get_system_setting(db, "smtp_host")
            if smtp_host:
                smtp_port = int((await crud.get_system_setting(db, "smtp_port")).value)
                smtp_user = (await crud.get_system_setting(db, "smtp_username")).value
                smtp_pass = (await crud.get_system_setting(db, "smtp_password")).value
                smtp_from = (await crud.get_system_setting(db, "smtp_from_email")).value
                smtp_security = (await crud.get_system_setting(db, "smtp_security")).value

                send_email(
                    to_email=user.email,
                    subject=subject,
                    html_body=html_body,
                    host=smtp_host.value,
                    port=smtp_port,
                    username=smtp_user,
                    password=smtp_pass,
                    from_email=smtp_from,
                    security=smtp_security
                )
        except Exception as e:
            logging.error(f"Failed to send reset email: {e}")
            # We don't fail the request to avoid leaking info, but for internal app maybe we should?
            # Let's just log it.

    return {"message": "Se o e-mail estiver cadastrado, você receberá um link para redefinição de senha."}

@router.post("/reset-password", status_code=200)
async def reset_password(request: schemas.ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    # 1. Decode and Validate Token
    try:
        payload = auth.jwt.decode(request.token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        scope: str = payload.get("scope")

        if email is None or scope != "password_reset":
             raise HTTPException(status_code=400, detail="Token inválido ou expirado")

    except auth.JWTError:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado")

    # 2. Get User
    result = await db.execute(select(models.User).where(models.User.email == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # 3. Update Password
    user.hashed_password = auth.get_password_hash(request.new_password)
    await db.commit()

    return {"message": "Senha atualizada com sucesso."}

@router.get("/setup-status")
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    # Check if there are any admins
    result = await db.execute(select(func.count(models.User.id)).where(models.User.role == models.UserRole.ADMIN))
    count = result.scalar()
    return {"is_setup": count > 0}

@router.post("/setup", response_model=schemas.UserResponse)
async def setup_admin(user: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    # Verify no admins exist
    result = await db.execute(select(func.count(models.User.id)).where(models.User.role == models.UserRole.ADMIN))
    count = result.scalar()

    if count > 0:
        raise HTTPException(status_code=403, detail="Configuração inicial já concluída. Existem administradores cadastrados.")

    # Create the master admin
    # Force role to ADMIN
    user.role = models.UserRole.ADMIN
    return await crud.create_user(db, user)

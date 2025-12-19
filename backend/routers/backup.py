import shutil
import subprocess
import os
import json
import zipfile
import tempfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db, DATABASE_URL
from backend.auth import get_current_user
from backend.models import User, UserRole, Log

router = APIRouter(
    prefix="/backup",
    tags=["backup"],
    responses={404: {"description": "Not found"}},
)

def get_db_connection_params():
    """
    Parse DATABASE_URL to get params for pg_dump/pg_restore.
    Handles the asyncpg url format: postgresql+asyncpg://...
    Returns: (host, port, user, password, dbname)
    """
    url = DATABASE_URL
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://")

    # We can use a library like yarl or just string manipulation if simple
    # But for robustness, let's look at how it's usually formatted.
    # Format: postgresql://user:password@host:port/dbname

    # Since we are inside the container, we can also use env vars if set,
    # but database.py falls back to constructing it from env vars.
    # Let's use the env vars directly as they are more reliable for the subprocess

    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("DB_HOST", "db")
    port = "5432" # Default internal port
    dbname = os.getenv("POSTGRES_DB", "inventory")

    return host, port, user, password, dbname

@router.get("/export")
async def export_backup(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Gera um dump completo do banco de dados (estrutura + dados),
    compacta em ZIP com metadados e retorna para download.
    Apenas ADMIN.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores podem realizar backups.")

    host, port, user, password, dbname = get_db_connection_params()

    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dump_filename = "database.dump"
    dump_path = os.path.join(temp_dir, dump_filename)

    # Metadata
    metadata = {
        "timestamp": datetime.now().isoformat(),
        "exported_by": current_user.email,
        "app_version": "1.0.0", # Could be dynamic
        "schema_version": "latest",
        "type": "full_backup"
    }
    metadata_path = os.path.join(temp_dir, "metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    # Run pg_dump
    # PGPASSWORD env var is the safest way to pass password to pg_dump
    env = os.environ.copy()
    env["PGPASSWORD"] = password

    try:
        # -F c: Custom format (compressed, suitable for pg_restore)
        command = [
            "pg_dump",
            "-h", host,
            "-p", port,
            "-U", user,
            "-d", dbname,
            "-F", "c",
            "-f", dump_path
        ]

        process = subprocess.run(command, env=env, capture_output=True, text=True)

        if process.returncode != 0:
            shutil.rmtree(temp_dir)
            raise HTTPException(status_code=500, detail=f"Erro ao gerar dump: {process.stderr}")

        # Zip everything
        zip_filename = f"backup_inventory_{timestamp}.zip"
        zip_path = os.path.join(temp_dir, zip_filename)

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(dump_path, dump_filename)
            zipf.write(metadata_path, "metadata.json")

        # Log action (Asynchronously write to DB log)
        # Note: We are using async session, so we need to be careful inside the route
        # create_log is synchronous or async? Let's check crud.py usually it is async if using AsyncSession
        # But for simplicity, we can just do it inline here.

        new_log = Log(
            user_id=current_user.id,
            item_id=None, # System level log
            action=f"BACKUP_EXPORT: Executado por {current_user.email}"
        )
        db.add(new_log)
        await db.commit()

        # Stream response
        def iterfile():
            with open(zip_path, "rb") as f:
                yield from f
            # Cleanup after stream
            shutil.rmtree(temp_dir)

        return StreamingResponse(
            iterfile(),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={zip_filename}"}
        )

    except Exception as e:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Recebe um arquivo ZIP de backup, valida e restaura o banco de dados.
    Apenas ADMIN.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores podem importar backups.")

    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Arquivo inválido. Deve ser um arquivo .zip gerado pelo sistema.")

    host, port, user, password, dbname = get_db_connection_params()
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "upload.zip")

    try:
        # Save upload to temp
        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Unzip
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        # Check files
        if not os.path.exists(os.path.join(temp_dir, "database.dump")):
             raise HTTPException(status_code=400, detail="Arquivo inválido: database.dump não encontrado no pacote.")

        # Check metadata (optional validation)
        metadata_path = os.path.join(temp_dir, "metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                meta = json.load(f)
                # Could add version checks here
                print(f"Restoring backup from {meta.get('timestamp')} by {meta.get('exported_by')}")

        dump_path = os.path.join(temp_dir, "database.dump")

        # Run pg_restore
        # --clean: drop objects before creating
        # --if-exists: used with --clean
        # -d: database

        env = os.environ.copy()
        env["PGPASSWORD"] = password

        command = [
            "pg_restore",
            "-h", host,
            "-p", port,
            "-U", user,
            "-d", dbname,
            "--clean",
            "--if-exists",
            "--no-owner", # Avoid ownership issues if users differ
            "--no-privileges", # Avoid privilege issues
            dump_path
        ]

        # Warning: This is a blocking operation. For large DBs, this should be a background task.
        # However, for this requirement, we will do it synchronously to report success/failure immediately.

        process = subprocess.run(command, env=env, capture_output=True, text=True)

        if process.returncode != 0:
            # Check strictly for errors. If pg_restore fails, we must alert the user.
            print(f"Restore Output: {process.stdout}")
            print(f"Restore Error: {process.stderr}")
            raise HTTPException(
                status_code=500,
                detail=f"Erro crítico ao restaurar banco de dados (Código {process.returncode}): {process.stderr}"
            )

        # Log action
        new_log = Log(
            user_id=current_user.id,
            item_id=None,
            action=f"BACKUP_IMPORT: Restaurado backup enviado por {current_user.email}"
        )
        db.add(new_log)
        await db.commit()

        return {"message": "Restauração concluída com sucesso. Por favor, faça login novamente se necessário."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(temp_dir)

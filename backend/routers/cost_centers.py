from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db
import csv
import io

router = APIRouter(prefix="/cost-centers", tags=["cost-centers"])

@router.get("/", response_model=List[schemas.CostCenterResponse])
async def read_cost_centers(
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # All authenticated users can read (for dropdowns)
    return await crud.get_cost_centers(db, skip=skip, limit=limit, search=search)

@router.post("/", response_model=schemas.CostCenterResponse)
async def create_cost_center(
    cost_center: schemas.CostCenterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem criar centros de custo")

    return await crud.create_cost_center(db, cost_center)

@router.put("/{cost_center_id}", response_model=schemas.CostCenterResponse)
async def update_cost_center(
    cost_center_id: int,
    cost_center: schemas.CostCenterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão negada")

    updated = await crud.update_cost_center(db, cost_center_id, cost_center)
    if not updated:
        raise HTTPException(status_code=404, detail="Centro de custo não encontrado")
    return updated

@router.delete("/{cost_center_id}")
async def delete_cost_center(
    cost_center_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão negada")

    success = await crud.delete_cost_center(db, cost_center_id)
    if not success:
        raise HTTPException(status_code=404, detail="Centro de custo não encontrado")
    return {"message": "Centro de custo removido"}

# Import/Export Endpoints

@router.get("/import/template")
async def get_import_template(
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão negada")

    header = ["CODIGO", "NOME", "DESCRICAO"]
    row_example = ["1001", "MARKETING", "CENTRO DE CUSTO DO DEPARTAMENTO DE MARKETING"]

    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(header)
    writer.writerow(row_example)
    output.seek(0)

    mem = io.BytesIO()
    mem.write(output.getvalue().encode('utf-8-sig'))
    mem.seek(0)

    return StreamingResponse(
        mem,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=modelo_centros_custo.csv"}
    )

@router.post("/import")
async def import_cost_centers(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão negada")

    contents = await file.read()
    filename = file.filename.lower()
    rows = []

    try:
        if filename.endswith('.csv'):
            content_str = contents.decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content_str), delimiter=';')
            reader.fieldnames = [f.strip().upper() for f in reader.fieldnames] if reader.fieldnames else []
            rows = list(reader)
        else:
            raise HTTPException(status_code=400, detail="Formato não suportado. Use .csv")

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler arquivo: {str(e)}")

    success_count = 0
    errors = []

    for index, row in enumerate(rows):
        try:
            code = str(row.get("CODIGO", "")).strip()
            name = str(row.get("NOME", "")).strip()
            description = str(row.get("DESCRICAO", "")).strip()

            if not code or not name:
                errors.append(f"Linha {index+2}: Código e Nome são obrigatórios.")
                continue

            # Check if exists
            existing = await crud.get_cost_center_by_code(db, code)

            if existing:
                # Update
                update_data = schemas.CostCenterUpdate(name=name, description=description)
                await crud.update_cost_center(db, existing.id, update_data)
                success_count += 1
            else:
                # Create
                new_cc = schemas.CostCenterCreate(code=code, name=name, description=description)
                await crud.create_cost_center(db, new_cc)
                success_count += 1

        except Exception as e:
            errors.append(f"Linha {index+2}: {str(e)}")

    return {"success": success_count, "errors": errors}

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db
import pandas as pd
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/export/excel")
async def export_inventory_excel(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    items = await crud.get_items(db, limit=10000) # Fetch all relevant items

    data = []
    for item in items:
        data.append({
            "ID": item.id,
            "Description": item.description,
            "Category": item.category,
            "Purchase Date": item.purchase_date,
            "Invoice Value": item.invoice_value,
            "Status": item.status,
            "Branch ID": item.branch_id
        })

    df = pd.DataFrame(data)
    stream = BytesIO()
    with pd.ExcelWriter(stream) as writer:
        df.to_excel(writer, index=False)

    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=inventory_report.xlsx"}
    )

@router.get("/export/pdf")
async def export_inventory_pdf(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    items = await crud.get_items(db, limit=10000)

    stream = BytesIO()
    p = canvas.Canvas(stream, pagesize=letter)
    width, height = letter
    y = height - 40

    p.setFont("Helvetica-Bold", 16)
    p.drawString(30, y, "Inventory Report")
    y -= 30
    p.setFont("Helvetica", 10)

    headers = ["ID", "Description", "Category", "Value", "Status"]
    x_positions = [30, 80, 250, 350, 450]

    for i, header in enumerate(headers):
        p.drawString(x_positions[i], y, header)

    y -= 20
    p.line(30, y+15, 550, y+15)

    for item in items:
        if y < 40:
            p.showPage()
            y = height - 40

        p.drawString(x_positions[0], y, str(item.id))
        p.drawString(x_positions[1], y, item.description[:30])
        p.drawString(x_positions[2], y, item.category)
        p.drawString(x_positions[3], y, f"{item.invoice_value:.2f}")
        p.drawString(x_positions[4], y, item.status)
        y -= 20

    p.save()
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=inventory_report.pdf"}
    )

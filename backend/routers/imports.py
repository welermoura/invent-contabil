from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import io
import csv
import openpyxl

router = APIRouter(prefix="/import", tags=["import"])

HEADER = ["DESCRICAO", "CATEGORIA", "FORNECEDOR_NOME", "FORNECEDOR_CNPJ", "DATA_COMPRA", "VALOR", "NUMERO_NOTA", "NUMERO_SERIE", "ATIVO_FIXO", "OBSERVACOES"]
ROW = ["NOTEBOOK DELL", "INFORMATICA", "DELL COMPUTADORES", "12.345.678/0001-99", "10/12/2024", "3450.99", "NF123456", "ABC123", "SIM", "ITEM IMPORTADO VIA EXEMPLO"]

@router.get("/example-csv")
async def get_example_csv():
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(HEADER)
    writer.writerow(ROW)
    output.seek(0)

    mem = io.BytesIO()
    mem.write(output.getvalue().encode('utf-8-sig'))
    mem.seek(0)

    return StreamingResponse(
        mem,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=exemplo_importacao.csv"}
    )

@router.get("/example-xlsx")
async def get_example_xlsx():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Importacao"

    ws.append(HEADER)
    ws.append(ROW)

    mem = io.BytesIO()
    wb.save(mem)
    mem.seek(0)

    return StreamingResponse(
        mem,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=exemplo_importacao.xlsx"}
    )

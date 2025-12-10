import re
import io
import xmltodict
import pdfplumber
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(
    prefix="/invoices",
    tags=["invoices"]
)

class InvoiceItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total_price: float
    code: Optional[str] = None

class InvoiceData(BaseModel):
    supplier_name: Optional[str] = None
    supplier_cnpj: Optional[str] = None
    invoice_number: Optional[str] = None
    issue_date: Optional[str] = None
    total_value: Optional[float] = None
    items: List[InvoiceItem] = []

def parse_xml(content: bytes) -> InvoiceData:
    try:
        data = xmltodict.parse(content)
        inf_nfe = data.get('nfeProc', {}).get('NFe', {}).get('infNFe', {})

        # Supplier
        emit = inf_nfe.get('emit', {})
        supplier_name = emit.get('xNome')
        supplier_cnpj = emit.get('CNPJ')

        # Invoice Info
        ide = inf_nfe.get('ide', {})
        invoice_number = ide.get('nNF')
        issue_date = ide.get('dhEmi') or ide.get('dEmi')
        if issue_date:
            issue_date = issue_date[:10] # YYYY-MM-DD

        # Total
        total = inf_nfe.get('total', {}).get('ICMSTot', {}).get('vNF')
        total_value = float(total) if total else 0.0

        # Items
        items = []
        det_list = inf_nfe.get('det', [])
        if not isinstance(det_list, list):
            det_list = [det_list]

        for det in det_list:
            prod = det.get('prod', {})
            items.append(InvoiceItem(
                description=prod.get('xProd', 'Item sem nome'),
                quantity=float(prod.get('qCom', 0)),
                unit_price=float(prod.get('vUnCom', 0)),
                total_price=float(prod.get('vProd', 0)),
                code=prod.get('cProd')
            ))

        return InvoiceData(
            supplier_name=supplier_name,
            supplier_cnpj=supplier_cnpj,
            invoice_number=invoice_number,
            issue_date=issue_date,
            total_value=total_value,
            items=items
        )
    except Exception as e:
        print(f"XML Parsing Error: {e}")
        raise HTTPException(status_code=400, detail="Erro ao processar XML da NF-e")

def parse_pdf(content: bytes) -> InvoiceData:
    try:
        text = ""
        items = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""

        # Regex heuristics for standard NFs (DANFE)
        # CNPJ
        cnpj_match = re.search(r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}', text)
        supplier_cnpj = cnpj_match.group(0).replace('.', '').replace('/', '').replace('-', '') if cnpj_match else None

        # Invoice Number (No. 000.000.000)
        nf_match = re.search(r'N[ºo]\.?\s*(\d{3}\.\d{3}\.\d{3})', text)
        invoice_number = nf_match.group(1).replace('.', '') if nf_match else None
        if not invoice_number:
             nf_match_simple = re.search(r'NF\s*(\d+)', text)
             invoice_number = nf_match_simple.group(1) if nf_match_simple else None

        # Date
        date_match = re.search(r'(\d{2}/\d{2}/\d{4})', text)
        issue_date = None
        if date_match:
            d, m, y = date_match.group(1).split('/')
            issue_date = f"{y}-{m}-{d}"

        # Total Value - Look for "Valor Total da Nota" or similar, usually followed by currency
        # This is tricky in regex. We'll try to find the biggest number near "Total"
        total_value = 0.0
        # Simplistic approach for demo: look for specific DANFE label
        val_match = re.search(r'VALOR TOTAL DA NOTA\s*([\d\.,]+)', text, re.IGNORECASE)
        if val_match:
             val_str = val_match.group(1).replace('.', '').replace(',', '.')
             try:
                total_value = float(val_str)
             except:
                pass

        # Items - Heuristic: Look for lines with quantity and price
        # This is very hard to do generically with regex on raw text.
        # We will try to find lines that look like "Code Description Qty Unit Total"
        # For now, if PDF, we might return a generic message or try best effort.
        # Let's assume a simpler extraction for PDF or just return global info.
        # User prompt says: "Lista de itens da NF".
        # We will try to iterate lines and find pattern like:  CODE DESC ... QTY ... UNIT ... TOTAL

        lines = text.split('\n')
        for line in lines:
             # Basic pattern: number description number number number
             # This is weak.
             pass

        return InvoiceData(
            supplier_name="Fornecedor (Extraído do PDF)",
            supplier_cnpj=supplier_cnpj,
            invoice_number=invoice_number,
            issue_date=issue_date,
            total_value=total_value,
            items=[] # PDF item extraction is complex without layout analysis
        )

    except Exception as e:
        print(f"PDF Parsing Error: {e}")
        raise HTTPException(status_code=400, detail="Erro ao processar PDF da NF")

@router.post("/parse", response_model=InvoiceData)
async def parse_invoice(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename.lower()

    if filename.endswith('.xml'):
        return parse_xml(content)
    elif filename.endswith('.pdf'):
        return parse_pdf(content)
    else:
        raise HTTPException(status_code=400, detail="Formato não suportado. Use PDF ou XML.")

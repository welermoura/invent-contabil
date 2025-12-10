import re
import io
import xmltodict
import pdfplumber
import pytesseract
import cv2
import numpy as np
from PIL import Image
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    serie: Optional[str] = None
    issue_date: Optional[str] = None
    total_value: Optional[float] = None
    items: List[InvoiceItem] = []
    source_type: str = "unknown" # xml, pdf_text, pdf_image, image

# --- Helper Functions ---

def clean_text(text: str) -> str:
    """Basic text cleaning."""
    if not text:
        return ""
    # Remove excessive newlines
    text = re.sub(r'\n+', '\n', text).strip()
    return text

def normalize_value(value_str: str) -> float:
    """Converts currency string to float."""
    if not value_str:
        return 0.0
    try:
        # Remove R$, spaces, and handle european number format (1.200,00 -> 1200.00)
        cleaned = value_str.lower().replace('r$', '').strip()

        # Check if it matches european format (dots for thousands, comma for decimal)
        if ',' in cleaned and '.' in cleaned:
             if cleaned.rfind(',') > cleaned.rfind('.'):
                 cleaned = cleaned.replace('.', '').replace(',', '.')
        elif ',' in cleaned:
             cleaned = cleaned.replace(',', '.')

        # Fix OCR errors (e.g., 'O' instead of '0', 'l' instead of '1') in numeric context
        # This is risky for mixed strings, but okay if we are sure it's value

        return float(cleaned)
    except Exception:
        return 0.0

def normalize_cnpj(cnpj: str) -> str:
    """Returns only digits."""
    if not cnpj:
        return ""
    return re.sub(r'\D', '', cnpj)

def extract_date(text: str) -> Optional[str]:
    """Finds date in YYYY-MM-DD format."""
    # Look for DD/MM/YYYY
    match = re.search(r'(\d{2})/(\d{2})/(\d{4})', text)
    if match:
        d, m, y = match.groups()
        return f"{y}-{m}-{d}"

    # Look for YYYY-MM-DD
    match = re.search(r'(\d{4})-(\d{2})-(\d{2})', text)
    if match:
        return match.group(0)

    return None

def preprocess_image(image_bytes: bytes) -> Image.Image:
    """Applies preprocessing to image for better OCR."""
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image")

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Apply thresholding
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Skew correction (Deskew)
        coords = np.column_stack(np.where(thresh > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        (h, w) = img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

        # Convert back to PIL Image
        rgb_image = cv2.cvtColor(rotated, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb_image)
    except Exception as e:
        logger.error(f"Image preprocessing failed: {e}")
        # Fallback to original
        return Image.open(io.BytesIO(image_bytes))

def extract_data_from_text(text: str) -> InvoiceData:
    """Extracts InvoiceData from raw text (OCR or PDF text) using Regex."""
    data = InvoiceData()

    # CNPJ
    # 00.000.000/0000-00
    cnpj_match = re.search(r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}', text)
    if cnpj_match:
        data.supplier_cnpj = normalize_cnpj(cnpj_match.group(0))

    # Invoice Number
    # NF 12345 or N. 12345 or No 12345
    nf_match = re.search(r'(?:N[ºo]\.?|NF|Nota)\s*[:.]?\s*(\d{1,9})', text, re.IGNORECASE)
    if nf_match:
        data.invoice_number = nf_match.group(1)

    # Series
    # Serie 1
    serie_match = re.search(r'S[ée]rie\s*[:.]?\s*(\d{1,3})', text, re.IGNORECASE)
    if serie_match:
        data.serie = serie_match.group(1)

    # Date
    data.issue_date = extract_date(text)

    # Total Value
    # Look for "Total" followed by currency
    total_match = re.search(r'(?:TOTAL|VALOR)\s*(?:DA\s*NOTA)?\s*(?:R\$)?\s*([\d\.,]+)', text, re.IGNORECASE)
    if total_match:
        try:
             # Find the last match which is usually the grand total at the bottom
             all_matches = re.findall(r'(?:TOTAL|VALOR A PAGAR|VALOR TOTAL)\s*.*?(?:R\$)?\s*([\d\.,]+)', text, re.IGNORECASE)
             if all_matches:
                 # Take the one that looks most like a large number (heuristic)
                 # Or just the last one
                 data.total_value = normalize_value(all_matches[-1])
        except:
             pass

    # Items Extraction (Heuristic)
    # Attempt to find lines with Quantity and Price
    lines = text.split('\n')
    for line in lines:
        # Simple heuristic: Look for a line ending with a number (price)
        # and containing a description. This is very prone to errors without layout analysis.
        # But we can try to grab lines that have:  Text ... Number ... Number

        # Regex for Line Item:  Description ... (Qty)? ... UnitPrice ... TotalPrice
        # Example: "Caneta Azul  2 UN  1.50  3.00"

        # We look for lines with at least 2 numbers at the end
        parts = re.findall(r'([\d\.,]+)', line)
        if len(parts) >= 2:
            try:
                val1 = normalize_value(parts[-1]) # Total
                val2 = normalize_value(parts[-2]) # Unit Price

                # If val2 is reasonable unit price
                if val1 > 0 and val2 > 0:
                     # Description is everything before numbers
                     # This effectively strips the numbers from the end
                     desc_match = re.search(r'^(.*?)(?=\d)', line)
                     description = desc_match.group(1).strip() if desc_match else "Item OCR"

                     if len(description) > 3:
                         qty = val1 / val2 if val2 != 0 else 1
                         # Round qty to nearest 0.5 or integer
                         qty = round(qty, 2)

                         data.items.append(InvoiceItem(
                             description=description,
                             quantity=qty,
                             unit_price=val2,
                             total_price=val1
                         ))
            except:
                continue

    return data

# --- Parsing Functions ---

def parse_xml(content: bytes) -> InvoiceData:
    try:
        data = xmltodict.parse(content)
        inf_nfe = data.get('nfeProc', {}).get('NFe', {}).get('infNFe', {})
        if not inf_nfe:
             # Try direct NFe
             inf_nfe = data.get('NFe', {}).get('infNFe', {})

        # Supplier
        emit = inf_nfe.get('emit', {})
        supplier_name = emit.get('xNome')
        supplier_cnpj = emit.get('CNPJ')

        # Invoice Info
        ide = inf_nfe.get('ide', {})
        invoice_number = ide.get('nNF')
        serie = ide.get('serie')
        issue_date = ide.get('dhEmi') or ide.get('dEmi')
        if issue_date:
            issue_date = issue_date[:10]

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
            serie=serie,
            issue_date=issue_date,
            total_value=total_value,
            items=items,
            source_type="xml"
        )
    except Exception as e:
        logger.error(f"XML Parsing Error: {e}")
        raise HTTPException(status_code=400, detail="Erro ao processar XML da NF-e")

def parse_pdf(content: bytes) -> InvoiceData:
    try:
        text = ""
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""

        # If text is too short, it's likely an image-based PDF
        if len(text.strip()) < 50:
            logger.info("PDF has little text, attempting OCR on PDF images...")
            # Extract images from PDF or Convert PDF to Image
            # For simplicity using pdfplumber, we can try to extract images or just fallback
            # Since pdfplumber image extraction can be complex, let's assume if text fails,
            # we treat it as "image" but we need a way to render it.
            # pypdfium2 (installed) can render pages to images.
            import pypdfium2 as pdfium

            pdf = pdfium.PdfDocument(content)
            full_text_ocr = ""
            for i in range(len(pdf)):
                page = pdf[i]
                image = page.render(scale=2).to_pil() # Render high res
                # Preprocess
                cv_img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
                _, encoded_img = cv2.imencode('.jpg', cv_img)
                processed_pil = preprocess_image(encoded_img.tobytes())

                # OCR
                # Define portuguese
                page_text = pytesseract.image_to_string(processed_pil, lang='por+eng')
                full_text_ocr += page_text + "\n"

            data = extract_data_from_text(full_text_ocr)
            data.source_type = "pdf_image"
            return data

        else:
            data = extract_data_from_text(text)
            data.source_type = "pdf_text"
            return data

    except Exception as e:
        logger.error(f"PDF Parsing Error: {e}")
        raise HTTPException(status_code=400, detail="Erro ao processar PDF da NF")

def parse_image_file(content: bytes) -> InvoiceData:
    try:
        # Preprocess
        processed_img = preprocess_image(content)

        # OCR
        text = pytesseract.image_to_string(processed_img, lang='por+eng')
        logger.info(f"OCR Extracted Text Preview: {text[:200]}...")

        data = extract_data_from_text(text)
        data.source_type = "image"

        if not data.items and len(text) < 20:
             raise HTTPException(status_code=422, detail="Imagem ilegível ou sem texto reconhecível. Tente melhorar a iluminação.")

        return data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image Parsing Error: {e}")
        raise HTTPException(status_code=400, detail="Erro ao processar imagem")

@router.post("/parse", response_model=InvoiceData)
async def parse_invoice(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename.lower()

    logger.info(f"Parsing file: {filename}")

    if filename.endswith('.xml'):
        return parse_xml(content)
    elif filename.endswith('.pdf'):
        return parse_pdf(content)
    elif filename.endswith(('.jpg', '.jpeg', '.png', '.heic', '.webp')):
        return parse_image_file(content)
    else:
        # Fallback treat as image if binary?
        raise HTTPException(status_code=400, detail="Formato não suportado. Use XML, PDF, JPG ou PNG.")

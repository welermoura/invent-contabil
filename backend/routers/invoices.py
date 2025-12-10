import re
import io
import xmltodict
import pdfplumber
import pytesseract
import cv2
import numpy as np
import pdf2image
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

# Blacklist de palavras que invalidam uma linha como item
BLACKLIST_WORDS = {
    "CHAVE", "ACESSO", "SERIE", "SÉRIE", "VENDA", "PRAZO", "TOTAL", "VALOR",
    "IMPOSTO", "CNPJ", "IE", "ENDERECO", "ENDEREÇO", "CEP", "TRANSPORTADORA",
    "OBSERVACAO", "OBSERVAÇÃO", "DOCUMENTO", "BASE", "ICMS", "IPI", "DESCONTO",
    "TELEFONE", "FONE", "PAGAMENTO", "EMISSAO", "EMISSÃO", "NATUREZA", "PROTOCOLO",
    "INSCRICAO", "INSCRIÇÃO", "SUBSTITUICAO", "SUBSTITUIÇÃO", "DANFE", "FRETE", "SEGURO",
    "RESOLUCAO", "RESOLUÇÃO", "MODELO", "SUBTOTAL", "COFINS", "PIS", "CONFIS", "ISSQN",
    "ALIQUOTA", "ALÍQUOTA", "OPERACAO", "OPERAÇÃO", "DADOS", "ADICIONAIS", "FISCO",
    "RESERVADO", "AUTENTICIDADE", "RECEBEMOS"
}

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

        # Fix OCR errors (e.g., 'O' instead of '0', 'l' instead of '1', 'I' instead of '1') in numeric context
        cleaned = cleaned.replace('o', '0').replace('l', '1').replace('i', '1')

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

def is_valid_line_item(line: str) -> Optional[InvoiceItem]:
    """
    Validates if a line is likely an invoice item based on strict fiscal rules.
    Returns InvoiceItem if valid, None otherwise.
    """
    line = line.strip()
    if not line:
        return None

    line_upper = line.upper()

    # Rule 4: Check Blacklist
    for bad_word in BLACKLIST_WORDS:
        if bad_word in line_upper:
            return None

    # Find numbers that look like prices/quantities (at least one digit, optional delimiters)
    # We want to exclude standalone years like "2023" if possible, but regex matches them.
    # We rely on context.

    # Heuristic: Find all numeric tokens at the END of the line
    # Regex for a number: digit+ ([.,] digit+)?
    # We want to match numbers that could be Qty or Price.

    # Let's find all numbers in the string
    numbers = re.findall(r'(\d+[.,]?\d*)', line)

    if len(numbers) < 2:
        # Missing either Qty or Price (or Total)
        return None

    try:
        # Strategy: The last number is likely Total or Unit Price.
        # The second to last is likely Unit Price or Qty.

        # Let's assume standard format: Description ... Qty ... Unit ... Total
        # But OCR often merges columns.

        val_last = normalize_value(numbers[-1])
        val_second_last = normalize_value(numbers[-2])

        # Determine which is Unit Price.
        # Usually Qty is smaller integer, Unit Price is float.
        # But we can have Qty 1.5 kg

        qty = 0.0
        unit_price = 0.0

        # Check plausibility of unit price
        # Rule 6: 1.00 <= price <= 200,000.00

        # Scenario A: Last is Total, 2nd Last is Unit Price -> Qty = Total / Unit
        if 1.0 <= val_second_last <= 200000.0:
            unit_price = val_second_last
            possible_total = val_last

            # Sanity check total
            if possible_total >= unit_price or abs(possible_total - unit_price) < 0.01:
                 # Check if we can derive Qty
                 if possible_total > 0 and unit_price > 0:
                     derived_qty = possible_total / unit_price
                     # If derived qty is close to 3rd last number, great.
                     # If not, assume derived_qty is the quantity.
                     qty = round(derived_qty, 3)
                 elif possible_total == 0:
                     # Maybe val_last is not total but garbage?
                     pass
            else:
                # Total < Unit Price? Unlikely unless discount.
                # Maybe last number IS Unit Price and 2nd last is Qty?
                pass

        # Scenario B: Last is Unit Price (and Qty is somewhere before)
        if qty == 0.0:
            if 1.0 <= val_last <= 200000.0:
                unit_price = val_last
                # Assume 2nd last is Qty
                qty = val_second_last
            else:
                # Neither look like valid unit prices
                return None

        # Rule: Quantity must be valid (> 0)
        if qty <= 0:
            return None

        # Refined Unit Price Check
        if not (1.0 <= unit_price <= 200000.0):
            return None

        # Rule 3: Description Extraction
        # Description is everything before the first number that starts the numeric block
        # We need to find where the "numeric part" of the line begins.

        # Regex to find the start of the sequence of numbers at the end of the line
        # We look for the position of the first digit of the first number involved in our calculation
        # This is a simplification. A better way: split line by the first occurrence of a number that isn't part of description.

        # Let's try to match the first digit in the line.
        match = re.search(r'\d', line)
        if not match:
            return None

        first_digit_idx = match.start()

        # However, descriptions can contain numbers ("Caneta 2000").
        # We want the numbers that act as columns.
        # Usually these are separated by larger spaces in PDF text, but OCR flattens it.
        # Let's assume description is everything up to the 2nd to last number found?
        # No, "Item 1 10.00 10.00".
        # Let's assume the description ends before the "Quantity" column.
        # If we identified `qty` and `unit_price`, we should look for their string representations in the line.

        # Heuristic: Split line by whitespace. Iterate backwards. Identify numbers. The rest is description.
        parts = line.split()
        numeric_indices = []
        for i, p in enumerate(parts):
            if re.match(r'^\d+[.,]?\d*$', p.replace('R$', '').replace('$', '')):
                numeric_indices.append(i)

        if len(numeric_indices) < 2:
            return None

        # Assume the last contiguous block of numbers are the values
        # Description is everything before that block.

        # Find where the trailing block of numbers starts
        # e.g. ["Desc", "Part", "1", "10.00", "10.00"] -> start index 2

        block_start = numeric_indices[-1]
        for idx in reversed(numeric_indices):
            if idx == block_start or idx == block_start - 1:
                block_start = idx
            else:
                break

        description_parts = parts[:block_start]
        description = " ".join(description_parts).strip()

        # Rule 5: Min 5 chars
        if len(description) < 5:
            return None

        # Clean description
        description = re.sub(r'^[.\-,\s]+', '', description)

        # Final sanity check: Description shouldn't look like a date or code only
        if re.match(r'^\d{2}/\d{2}/\d{4}$', description):
            return None

        return InvoiceItem(
            description=description,
            quantity=qty,
            unit_price=unit_price,
            total_price=round(qty * unit_price, 2)
        )

    except Exception:
        return None

def extract_data_from_text(text: str) -> InvoiceData:
    """Extracts InvoiceData from raw text (OCR or PDF text) using Regex and heuristics."""
    data = InvoiceData()

    # CNPJ
    # 00.000.000/0000-00
    cnpj_match = re.search(r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}', text)
    if cnpj_match:
        data.supplier_cnpj = normalize_cnpj(cnpj_match.group(0))

    # Invoice Number
    nf_match = re.search(r'(?:N[ºo]\.?|NF|Nota)\s*[:.]?\s*(\d{1,9})', text, re.IGNORECASE)
    if nf_match:
        data.invoice_number = nf_match.group(1)

    # Series
    serie_match = re.search(r'S[ée]rie\s*[:.]?\s*(\d{1,3})', text, re.IGNORECASE)
    if serie_match:
        data.serie = serie_match.group(1)

    # Date
    data.issue_date = extract_date(text)

    # Total Value
    # Heuristic: Biggest number usually
    total_candidates = re.findall(r'(\d+[.,]\d{2})', text) # Only strictly formatted currency candidates
    if total_candidates:
        try:
            values = [normalize_value(v) for v in total_candidates]
            if values:
                data.total_value = max(values)
        except:
            pass

    # Items Extraction (Smart Parser)
    lines = text.split('\n')
    for line in lines:
        item = is_valid_line_item(line)
        if item:
            # Avoid duplicate items if lines are repeated (common in OCR)
            is_duplicate = any(i.description == item.description and abs(i.total_price - item.total_price) < 0.01 for i in data.items)
            if not is_duplicate:
                data.items.append(item)

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

            # Use pdf2image to convert PDF to images
            images = pdf2image.convert_from_bytes(content, dpi=300)
            full_text_ocr = ""

            for i, image in enumerate(images):
                # Preprocess each page image
                # Convert PIL to OpenCV
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
        raise HTTPException(status_code=400, detail="Erro ao processar PDF da NF. Verifique se o arquivo não está corrompido.")

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
             # Even if no items found, return metadata if present. Only error if completely empty/garbage.
             pass

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

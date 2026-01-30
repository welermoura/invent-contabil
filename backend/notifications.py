from sqlalchemy.ext.asyncio import AsyncSession
from backend import models, crud
import smtplib
import ssl
from email.message import EmailMessage
from typing import List, Optional, Union
import asyncio
from backend.redis_client import get_redis_settings
from arq import create_pool

async def get_approvers(db: AsyncSession) -> List[models.User]:
    """Get all admins and approvers."""
    return await crud.get_users_by_role(db, [models.UserRole.ADMIN, models.UserRole.APPROVER])

async def get_branch_members(db: AsyncSession, branch_id: int) -> List[models.User]:
    """Get all operators assigned to a specific branch."""
    operators = await crud.get_users_by_role(db, [models.UserRole.OPERATOR])
    branch_members = []

    for user in operators:
        if user.all_branches:
            branch_members.append(user)
            continue

        if user.branch_id == branch_id:
            branch_members.append(user)
            continue

        if any(b.id == branch_id for b in user.branches):
            branch_members.append(user)

    return branch_members

def generate_html_email(title: str, message: str, item_details: Optional[Union[dict, List[dict]]] = None, action_url: Optional[str] = None, action_text: Optional[str] = "Ver no Sistema", app_title: str = "Sistema de Inventário") -> str:
    """Generates a modern, responsive HTML email body with item details table (single or list)."""
    # ... (Same as before, lengthy HTML generation code)
    # Re-inserting the previous implementation here to avoid truncating it in the tool
    item_table_html = ""
    if item_details:
        items_list = [item_details] if isinstance(item_details, dict) else item_details
        if items_list:
            labels = {
                "description": "Descrição", "category": "Categoria", "fixed_asset_number": "Ativo Fixo",
                "serial_number": "Nº Série", "branch": "Filial", "status": "Status",
                "invoice_value": "Valor (R$)", "purchase_date": "Data Compra", "supplier": "Fornecedor",
                "invoice_number": "Número da NF", "invoice_link": "Arquivo da NF", "observations": "Observações",
                "responsible": "Responsável", "transfer_target": "Destino (Transferência)"
            }
            def format_val(k, v):
                if v is None or v == "": return "-"
                if k == "invoice_value":
                    try: return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                    except: return str(v)
                if k == "purchase_date": return str(v).split(' ')[0]
                if k == "invoice_link": return f'<a href="{v}" target="_blank" style="color: #2563eb; text-decoration: underline;">Visualizar</a>'
                return str(v)

            priority_keys = ["description", "fixed_asset_number", "category", "branch", "status", "serial_number", "invoice_value", "purchase_date", "invoice_number", "invoice_link", "supplier", "responsible"]
            ignored_keys = ["observations"]
            present_keys = set()
            for it in items_list:
                present_keys.update(k for k in it.keys() if it[k])
                present_keys.update(it.keys())
            columns = []
            for k in priority_keys:
                if k in present_keys and k not in ignored_keys: columns.append(k)
            for k in present_keys:
                if k not in columns and k not in ignored_keys and k in labels: columns.append(k)

            border_style = "1px solid #9ca3af"
            headers_html = ""
            for k in columns:
                label = labels.get(k, k)
                headers_html += f'<th style="padding: 12px; border-bottom: {border_style}; border-right: {border_style}; color: #374151; font-weight: 700; text-align: left; white-space: nowrap; background-color: #f3f4f6;">{label}</th>'
            rows_html = ""
            for it in items_list:
                row_cells = ""
                for k in columns:
                    val = format_val(k, it.get(k))
                    row_cells += f'<td style="padding: 12px; border-bottom: {border_style}; border-right: {border_style}; color: #111827; white-space: nowrap;">{val}</td>'
                rows_html += f'<tr>{row_cells}</tr>'

            if headers_html:
                title_label = "Detalhes do Item" if len(items_list) == 1 else f"Lista de Itens ({len(items_list)})"
                item_table_html = f"""
                <div style="margin: 24px 0; background-color: #f9fafb; border-radius: 8px; padding: 16px;">
                    <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px; color: #374151;">{title_label}</h3>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px; border-top: {border_style}; border-left: {border_style};">
                            <thead><tr style="border-top: {border_style}; border-left: {border_style};">{headers_html}</tr></thead>
                            <tbody>{rows_html}</tbody>
                        </table>
                    </div>
                </div>"""

    html = f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            body {{ font-family: 'Inter', Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; color: #1f2937; }}
            .wrapper {{ width: 100%; background-color: #f3f4f6; padding: 40px 0; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px 20px; text-align: center; }}
            .header h1 {{ color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; }}
            .content {{ padding: 40px 30px; }}
            .message-title {{ font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 16px; }}
            .message-body {{ font-size: 16px; line-height: 1.6; color: #4b5563; margin-bottom: 30px; }}
            .action-button {{ display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px; transition: background-color 0.2s; }}
            .action-button:hover {{ background-color: #1d4ed8; }}
            .footer {{ background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; }}
            .footer p {{ margin: 0; font-size: 12px; color: #9ca3af; }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="header"><h1>{app_title}</h1></div>
                <div class="content">
                    <h2 class="message-title">{title}</h2>
                    <div class="message-body">{message.replace(chr(10), '<br>')}</div>
                    {item_table_html}
                    {f'<div style="text-align: center; margin-top: 30px;"><a href="{action_url}" class="action-button">{action_text}</a></div>' if action_url else ''}
                </div>
                <div class="footer"><p>Este é um e-mail automático. Por favor, não responda.</p><p style="margin-top: 8px;">&copy; {app_title}. Todos os direitos reservados.</p></div>
            </div>
        </div>
    </body>
    </html>
    """
    return html

# Global ARQ pool for enqueuing
_arq_pool = None

async def get_arq_pool_cached():
    global _arq_pool
    if _arq_pool is None:
        _arq_pool = await create_pool(get_redis_settings())
    return _arq_pool

async def notify_users(
    db: AsyncSession,
    users: List[models.User],
    title: str,
    message: str,
    email_subject: Optional[str] = None,
    email_html: Optional[str] = None
):
    """
    Sends in-app notifications and enqueues email tasks.
    """
    if not users:
        return

    # 1. In-App Notifications
    try:
        for user in users:
            notification = models.Notification(user_id=user.id, title=title, message=message)
            db.add(notification)
        await db.commit()
    except Exception as e:
        print(f"Error saving in-app notifications: {e}")
        try: await db.rollback()
        except: pass

    # 2. Email Notifications (Async Enqueue)
    try:
        smtp_host_setting = await crud.get_system_setting(db, "smtp_host")
        if not smtp_host_setting:
            return

        # Prepare context data once
        app_title_setting = await crud.get_system_setting(db, "app_title")
        app_title = app_title_setting.value if app_title_setting else "Sistema de Inventário"
        final_subject = email_subject or title
        if app_title: final_subject = f"[{app_title}] {final_subject}"
        body_html = email_html or generate_html_email(title, message, app_title=app_title)

        # Enqueue tasks
        pool = await get_arq_pool_cached()
        sent_emails = set()
        for user in users:
            if user.email and "@" in user.email and user.email not in sent_emails:
                await pool.enqueue_job('send_email_task', to_email=user.email, subject=final_subject, html_content=body_html)
                sent_emails.add(user.email)

    except Exception as e:
        print(f"Notification Logic Error (Email skipped): {e}")

async def create_notification(db: AsyncSession, user_id: int, title: str, message: str):
    notification = models.Notification(user_id=user_id, title=title, message=message)
    db.add(notification)
    try:
        await db.commit()
        await db.refresh(notification)
    except Exception:
        await db.rollback()
    return notification

async def send_email_sync_wrapper(to_email, subject, html_content):
    """
    Wrapper to run synchronous SMTP code.
    In a real worker, we might get SMTP settings from DB again or pass them in job args.
    Passing sensitive SMTP creds in job args (Redis) is risky if Redis isn't secure.
    Better: Worker fetches creds from DB or Env.
    For this refactor, we'll fetch from DB inside the worker or assume Env.
    Since the worker code in worker.py imports this, let's keep the logic here but make it self-contained
    or strictly require DB access.

    ISSUE: The worker process needs a DB session to fetch SMTP settings if we don't pass them.
    Passing them in args is easier for now but less secure.
    Let's fetch from ENV or DB. The original code fetched from DB.

    Refactor: We will use a separate DB session in the worker task if needed, OR pass creds if we trust Redis.
    To be robust/enterprise, we should fetch from Vault/Env/DB.
    Let's implement a 'get_smtp_settings' helper and use it.

    However, 'send_email' used to take host/port/etc.
    Let's modify 'send_email_sync_wrapper' to instantiate a session and fetch settings,
    OR just accept that we need to pass them.

    Decision: To avoid complexity of DB connection in worker right now (needs async session setup in sync context or async task),
    we will rely on the `send_email` function being called with args.
    Wait, `send_email_task` in `worker.py` calls `send_email_sync_wrapper`.
    We need to retrieve SMTP settings inside `send_email_sync_wrapper`.

    We'll implement a context manager for DB in the worker if possible, or just pass the config for this iteration.
    Passing config via Redis job args is acceptable for internal Redis.
    """
    # This function is called by the worker.
    # We need to fetch SMTP settings. Since this is async, we can connect to DB.
    # But wait, send_email_sync_wrapper suggests it wraps the sync call.

    # Let's actually Fetch settings here.
    # We need a new DB session.
    from backend.database import SessionLocal
    from backend import crud

    async with SessionLocal() as db:
        host = await crud.get_system_setting(db, "smtp_host")
        if not host:
            print("No SMTP host configured.")
            return
        host = host.value
        port = int((await crud.get_system_setting(db, "smtp_port")).value)
        username = (await crud.get_system_setting(db, "smtp_username")).value
        password = (await crud.get_system_setting(db, "smtp_password")).value
        from_email = (await crud.get_system_setting(db, "smtp_from_email")).value
        security = (await crud.get_system_setting(db, "smtp_security")).value

    # Now call sync send_email in a thread
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, send_email, to_email, subject, html_content, host, port, username, password, from_email, security)

def send_email(to_email, subject, html_body, host, port, username, password, from_email, security):
    # Pure sync SMTP logic
    try:
        msg = EmailMessage()
        msg.set_content("Por favor, ative a visualização HTML para ler esta mensagem.")
        msg.add_alternative(html_body, subtype='html')
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email

        if security == "SSL":
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                if username: server.login(username, password)
                server.send_message(msg)
        elif security == "TLS":
            context = ssl.create_default_context()
            with smtplib.SMTP(host, port) as server:
                server.starttls(context=context)
                if username: server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port) as server:
                if username: server.login(username, password)
                server.send_message(msg)
        print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

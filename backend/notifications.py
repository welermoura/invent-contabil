from sqlalchemy.ext.asyncio import AsyncSession
from backend import models, crud
import smtplib
import ssl
from email.message import EmailMessage
from typing import List, Optional

async def get_approvers(db: AsyncSession) -> List[models.User]:
    """Get all admins and approvers."""
    return await crud.get_users_by_role(db, [models.UserRole.ADMIN, models.UserRole.APPROVER])

async def get_branch_members(db: AsyncSession, branch_id: int) -> List[models.User]:
    """Get all operators assigned to a specific branch."""
    # We need to fetch all operators and filter by branch.
    # Optimized: A specific query would be better, but we reuse existing crud for now or add a new one.
    # Adding a helper in crud would be best, but let's implement a direct query here to be safe.
    from sqlalchemy.future import select

    # Logic: Users who are OPERATOR AND (have branch_id OR are in user_branches)
    # This is complex to do in one query without a dedicated CRUD method.
    # Let's fetch all operators and filter in python for simplicity/safety unless list is huge.
    # Realistically, for an internal tool, filtering 1000 users in python is fine.

    operators = await crud.get_users_by_role(db, [models.UserRole.OPERATOR])
    branch_members = []

    for user in operators:
        if user.all_branches:
            branch_members.append(user)
            continue

        # Check Legacy
        if user.branch_id == branch_id:
            branch_members.append(user)
            continue

        # Check Many-to-Many
        # Note: user.branches is lazy loaded. In async we need to ensure it's loaded.
        # crud.get_users_by_role uses 'selectinload', so it should be populated.
        if any(b.id == branch_id for b in user.branches):
            branch_members.append(user)

    return branch_members

def generate_html_email(title: str, message: str, action_url: Optional[str] = None, action_text: Optional[str] = "Ver no Sistema", app_title: str = "Sistema de Inventário") -> str:
    """Generates a modern, responsive HTML email body."""

    html = f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

            body {{
                font-family: 'Inter', Arial, sans-serif;
                background-color: #f3f4f6;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
                color: #1f2937;
            }}
            .wrapper {{
                width: 100%;
                background-color: #f3f4f6;
                padding: 40px 0;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                overflow: hidden;
            }}
            .header {{
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                padding: 30px 20px;
                text-align: center;
            }}
            .header h1 {{
                color: #ffffff;
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: -0.025em;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .message-title {{
                font-size: 20px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 16px;
            }}
            .message-body {{
                font-size: 16px;
                line-height: 1.6;
                color: #4b5563;
                margin-bottom: 30px;
            }}
            .action-button {{
                display: inline-block;
                background-color: #2563eb;
                color: #ffffff !important;
                font-weight: 600;
                text-decoration: none;
                padding: 12px 32px;
                border-radius: 8px;
                transition: background-color 0.2s;
            }}
            .action-button:hover {{
                background-color: #1d4ed8;
            }}
            .footer {{
                background-color: #f9fafb;
                padding: 24px;
                text-align: center;
                border-top: 1px solid #e5e7eb;
            }}
            .footer p {{
                margin: 0;
                font-size: 12px;
                color: #9ca3af;
            }}
            .app-name {{
                font-weight: 600;
                color: #6b7280;
            }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="header">
                    <h1>{app_title}</h1>
                </div>
                <div class="content">
                    <h2 class="message-title">{title}</h2>
                    <div class="message-body">
                        {message.replace(chr(10), '<br>')}
                    </div>
                    {f'<div style="text-align: center;"><a href="{action_url}" class="action-button">{action_text}</a></div>' if action_url else ''}
                </div>
                <div class="footer">
                    <p>Este é um e-mail automático. Por favor, não responda.</p>
                    <p style="margin-top: 8px;">&copy; {app_title}. Todos os direitos reservados.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    return html

async def notify_users(
    db: AsyncSession,
    users: List[models.User],
    title: str,
    message: str,
    email_subject: Optional[str] = None,
    email_html: Optional[str] = None
):
    """
    Sends in-app notifications and attempts to send emails to a list of users.
    Optimized to commit once.
    """
    if not users:
        return

    # 1. In-App Notifications
    try:
        for user in users:
            notification = models.Notification(
                user_id=user.id,
                title=title,
                message=message
            )
            db.add(notification)

        # Commit all notifications in one go
        await db.commit()
    except Exception as e:
        print(f"Error saving in-app notifications: {e}")
        # Try to rollback but proceed to email
        try:
            await db.rollback()
        except:
            pass

    # 2. Email Notifications
    try:
        smtp_host_setting = await crud.get_system_setting(db, "smtp_host")
        if not smtp_host_setting:
            return

        smtp_port = int((await crud.get_system_setting(db, "smtp_port")).value)
        smtp_user = (await crud.get_system_setting(db, "smtp_username")).value
        smtp_pass = (await crud.get_system_setting(db, "smtp_password")).value
        smtp_from = (await crud.get_system_setting(db, "smtp_from_email")).value
        smtp_security = (await crud.get_system_setting(db, "smtp_security")).value

        # Get App Title for subject
        app_title_setting = await crud.get_system_setting(db, "app_title")
        app_title = app_title_setting.value if app_title_setting else "Sistema de Inventário"

        # Format Subject: [AppName] Title
        final_subject = email_subject or title
        if app_title:
             final_subject = f"[{app_title}] {final_subject}"

        # Use provided HTML or generate default with app title
        body_html = email_html or generate_html_email(title, message, app_title=app_title)

        # Deduplicate users by email
        sent_emails = set()

        for user in users:
            if user.email and "@" in user.email and user.email not in sent_emails:
                send_email(
                    to_email=user.email,
                    subject=final_subject,
                    html_body=body_html,
                    host=smtp_host_setting.value,
                    port=smtp_port,
                    username=smtp_user,
                    password=smtp_pass,
                    from_email=smtp_from,
                    security=smtp_security
                )
                sent_emails.add(user.email)

    except Exception as e:
        print(f"Notification Logic Error (Email skipped): {e}")

async def create_notification(db: AsyncSession, user_id: int, title: str, message: str):
    """
    Creates a notification for a single user.
    Note: This commits immediately. Use notify_users for bulk.
    """
    notification = models.Notification(
        user_id=user_id,
        title=title,
        message=message
    )
    db.add(notification)
    try:
        await db.commit()
        await db.refresh(notification)
    except Exception:
        await db.rollback()
    return notification

def send_email(to_email, subject, html_body, host, port, username, password, from_email, security):
    try:
        msg = EmailMessage()
        msg.set_content("Por favor, ative a visualização HTML para ler esta mensagem.") # Fallback
        msg.add_alternative(html_body, subtype='html')

        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email

        if security == "SSL":
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                if username:
                    server.login(username, password)
                server.send_message(msg)
        elif security == "TLS":
            context = ssl.create_default_context()
            with smtplib.SMTP(host, port) as server:
                server.starttls(context=context)
                if username:
                    server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port) as server:
                if username:
                    server.login(username, password)
                server.send_message(msg)
        print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

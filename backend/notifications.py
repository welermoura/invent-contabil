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

def generate_html_email(title: str, message: str, action_url: Optional[str] = None, action_text: Optional[str] = "Ver no Sistema") -> str:
    """Generates a clean HTML email body."""

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; }}
            .header {{ background-color: #4F46E5; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ padding: 20px; background-color: white; }}
            .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
            .button {{ display: inline-block; padding: 10px 20px; margin-top: 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>{title}</h2>
            </div>
            <div class="content">
                <p>Olá,</p>
                <p>{message.replace(chr(10), '<br>')}</p>

                {f'<a href="{action_url}" class="button">{action_text}</a>' if action_url else ''}
            </div>
            <div class="footer">
                <p>Este é um e-mail automático do Sistema de Inventário. Por favor, não responda.</p>
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

        subject = email_subject or title
        # Use provided HTML or generate default
        body_html = email_html or generate_html_email(title, message)

        # Deduplicate users by email
        sent_emails = set()

        for user in users:
            if user.email and "@" in user.email and user.email not in sent_emails:
                send_email(
                    to_email=user.email,
                    subject=subject,
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

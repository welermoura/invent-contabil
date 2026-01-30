import asyncio
from arq import create_pool
from arq.connections import RedisSettings
import os
import sys

# Add backend path to sys.path to resolve imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.notifications import send_email_sync_wrapper
from backend.redis_client import get_redis_settings

# Task Definition
async def send_email_task(ctx, to_email: str, subject: str, html_content: str):
    """
    Background task to send email.
    We wrap the synchronous send_email logic if it's blocking,
    or just call it if we refactor it to be async.
    The current implementation uses standard smtplib which is blocking.
    So we run it in a threadpool executor via the wrapper or just direct sync call
    (since worker is async, blocking call blocks the worker).
    Ideally, use aiosmtplib. But for now, let's stick to existing logic running in thread.
    """
    print(f"Processing email task for {to_email}")
    # send_email_sync_wrapper handles the thread pool execution
    await send_email_sync_wrapper(to_email, subject, html_content)
    print(f"Email sent to {to_email}")

# Worker Settings
async def startup(ctx):
    print("Worker starting...")

async def shutdown(ctx):
    print("Worker shutting down...")

class WorkerSettings:
    functions = [send_email_task]
    redis_settings = get_redis_settings()
    on_startup = startup
    on_shutdown = shutdown

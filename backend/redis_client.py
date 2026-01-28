from redis.asyncio import Redis, from_url
from arq.connections import RedisSettings, create_pool, ArqRedis
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Separate pool for general caching
redis_cache: Redis | None = None

# Separate pool for ARQ jobs (if needed, though create_pool manages its own)
arq_pool: ArqRedis | None = None

async def get_redis_cache() -> Redis:
    global redis_cache
    if redis_cache is None:
        redis_cache = from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    return redis_cache

async def get_arq_pool() -> ArqRedis:
    global arq_pool
    if arq_pool is None:
        # ARQ parses REDIS_URL internally if we pass settings?
        # Actually create_pool takes RedisSettings.
        # We need to parse REDIS_URL into RedisSettings manually or let arq do it?
        # RedisSettings.from_dsn is available in newer versions or we can parse manually.
        # For simplicity, we assume standard format or use from_dsn if available.
        # Let's use simple manual parsing or default if complexity arises.
        # arq `create_pool` usually takes settings.

        # Simple parsing for host/port/db
        # This is a bit brittle, robust DSN parsing is better.
        # Assuming format redis://host:port/db

        from urllib.parse import urlparse
        parsed = urlparse(REDIS_URL)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        db = 0
        if parsed.path and len(parsed.path) > 1:
            try:
                db = int(parsed.path[1:])
            except:
                pass

        password = parsed.password

        settings = RedisSettings(host=host, port=port, database=db, password=password)
        arq_pool = await create_pool(settings)

    return arq_pool

def get_redis_settings():
    from urllib.parse import urlparse
    parsed = urlparse(REDIS_URL)
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379
    db = 0
    if parsed.path and len(parsed.path) > 1:
        try:
            db = int(parsed.path[1:])
        except:
            pass
    password = parsed.password
    return RedisSettings(host=host, port=port, database=db, password=password)

async def close_redis():
    global redis_cache, arq_pool
    if redis_cache:
        await redis_cache.close()
    if arq_pool:
        await arq_pool.close()

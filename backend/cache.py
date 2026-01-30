import json
from functools import wraps
from typing import Optional, Any
from backend.redis_client import get_redis_cache
from fastapi import Request, Response
from fastapi.encoders import jsonable_encoder

DEFAULT_TTL = 3600  # 1 hour

def cache_response(ttl: int = DEFAULT_TTL, key_prefix: str = ""):
    """
    Decorator to cache endpoint responses using Redis.
    Uses 'request.url.path + request.query_params' as key suffix.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract Request object
            request: Optional[Request] = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                for k, v in kwargs.items():
                    if isinstance(v, Request):
                        request = v
                        break

            if not request:
                # Cannot determine key without request, skip caching or use manual key
                return await func(*args, **kwargs)

            # Generate Cache Key
            # Format: "prefix:path:query_string"
            cache_key = f"{key_prefix}:{request.url.path}:{request.url.query}"

            try:
                redis = await get_redis_cache()
                cached_data = await redis.get(cache_key)
                if cached_data:
                    # Determine return type. Ideally we return the object and FastAPI serializes it.
                    # But caching usually stores the serialized JSON.
                    # If we return a dict/list, FastAPI will re-serialize.
                    return json.loads(cached_data)
            except Exception as e:
                print(f"Cache Read Error: {e}")

            # Execute logic
            response_data = await func(*args, **kwargs)

            # Write to Cache
            try:
                # jsonable_encoder handles SQLAlchemy models, Pydantic models, and basic types
                # converting them to JSON-compatible dicts/lists.
                serialized = jsonable_encoder(response_data)

                redis = await get_redis_cache()
                await redis.set(cache_key, json.dumps(serialized), ex=ttl)
            except Exception as e:
                print(f"Cache Write Error: {e}")

            return response_data
        return wrapper
    return decorator

async def invalidate_cache(key_pattern: str):
    """
    Invalidates keys matching a pattern.
    Pattern examples: "settings:*", "branches:*"
    """
    try:
        redis = await get_redis_cache()
        # Scan for keys
        keys = []
        async for key in redis.scan_iter(key_pattern):
            keys.append(key)

        if keys:
            await redis.delete(*keys)
    except Exception as e:
        print(f"Cache Invalidation Error: {e}")

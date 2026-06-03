"""Simple cache wrapper: prefer Redis but fall back to an in-memory dict.

API:
 - get_client() -> redis.Redis or InMemoryCache
 - set(key, value, ex=None)
 - get(key)
 - delete(key)
 - flush()

Designed to be resilient for tests and local development where Redis
may not be available.
"""
import os
import threading
import time
import json

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/1")


class InMemoryCache:
    def __init__(self):
        self.store = {}
        self.lock = threading.Lock()

    def set(self, key, value, ex=None):
        with self.lock:
            expiry = time.time() + ex if ex else None
            # Store as JSON string for simple interoperability
            self.store[key] = (json.dumps(value), expiry)

    def get(self, key):
        with self.lock:
            v = self.store.get(key)
            if not v:
                return None
            val_s, expiry = v
            if expiry and time.time() > expiry:
                del self.store[key]
                return None
            try:
                return json.loads(val_s)
            except Exception:
                return val_s

    def delete(self, key):
        with self.lock:
            if key in self.store:
                del self.store[key]

    def flushall(self):
        with self.lock:
            self.store.clear()


_client = None
_using_redis = False

try:
    import redis

    _client = redis.from_url(REDIS_URL, decode_responses=True)
    # quick ping to ensure connectivity
    try:
        _client.ping()
        _using_redis = True
    except Exception:
        # fallback to in-memory
        _client = InMemoryCache()
        _using_redis = False
except Exception:
    _client = InMemoryCache()
    _using_redis = False


def get_client():
    """Return the underlying client (redis.Redis or InMemoryCache).

    Tests can introspect whether Redis is actually in use by checking
    the return type or by reading the `_using_redis` flag.
    """
    return _client


def using_redis() -> bool:
    return _using_redis


def set(key, value, ex=None):
    if _using_redis:
        # redis expects seconds expiration
        _client.set(key, json.dumps(value), ex=ex)
    else:
        _client.set(key, value, ex=ex)


def get(key):
    if _using_redis:
        v = _client.get(key)
        if v is None:
            return None
        try:
            return json.loads(v)
        except Exception:
            return v
    else:
        return _client.get(key)


def delete(key):
    if _using_redis:
        _client.delete(key)
    else:
        _client.delete(key)


def flush():
    if _using_redis:
        _client.flushdb()
    else:
        _client.flushall()

from backend import cache


def test_auth_token_cache():
    cache.flush()
    cache.set("auth:token:1", {"user": "u1"}, ex=5)
    v = cache.get("auth:token:1")
    assert v == {"user": "u1"}
    cache.delete("auth:token:1")
    assert cache.get("auth:token:1") is None

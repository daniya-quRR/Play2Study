from backend import cache


def test_cache_basic_set_get_delete():
    cache.flush()
    cache.set("x", {"a": 1}, ex=2)
    v = cache.get("x")
    assert v == {"a": 1}
    cache.delete("x")
    assert cache.get("x") is None


def test_cache_using_redis_flag():
    # This test just asserts the flag exists and is a boolean
    assert isinstance(cache.using_redis(), bool)

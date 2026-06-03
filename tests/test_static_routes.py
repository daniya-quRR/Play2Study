import os
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root_or_404():
    r = client.get("/")
    assert r.status_code in (200, 404)


def test_nonexistent_static():
    r = client.get("/this-file-should-not-exist.txt")
    assert r.status_code == 404

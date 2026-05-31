from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_register():
    response = client.post("/auth", json={
        "username": "testuser",
        "password": "testpass123",
        "email": "test@example.com",
        "register": True
    })

    assert response.status_code in [200, 400]
def test_login_fail():
    response = client.post("/auth", json={
        "username": "wronguser",
        "password": "wrongpass",
        "register": False
    })

    assert response.status_code == 400
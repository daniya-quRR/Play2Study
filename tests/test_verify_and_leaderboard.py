from fastapi.testclient import TestClient
from backend.main import app, SessionLocal, User
import uuid

client = TestClient(app)


def test_verify_endpoint_and_leaderboard():
    suffix = uuid.uuid4().hex[:8]
    username = f"v_{suffix}"
    email = f"{username}@example.com"
    db = SessionLocal()
    u = User(username=username, email=email, hashed_password="x", is_verified=False, verification_code="123456")
    db.add(u)
    db.commit()
    db.close()

    r = client.post("/verify", params={"email": email, "code": "123456"})
    assert r.status_code == 200

    r = client.get("/leaderboard")
    assert r.status_code == 200

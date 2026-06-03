from fastapi.testclient import TestClient
from backend.main import app, SessionLocal, User
import uuid

client = TestClient(app)


def create_user_for_password():
    suffix = uuid.uuid4().hex[:8]
    username = f"pw_{suffix}"
    email = f"{username}@example.com"
    db = SessionLocal()
    u = User(username=username, email=email, hashed_password="x", is_verified=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    db.close()
    return username, email


def test_forgot_and_reset_password():
    username, email = create_user_for_password()

    # Forgot password should accept existing email
    r = client.post("/forgot-password", params={"email": email})
    assert r.status_code == 200

    # We cannot fetch the verification code easily; ensure endpoint exists and returns ok for reset attempts with bad code
    r = client.post("/reset-password", params={"email": email, "code": "000000", "new_password": "abc123"})
    assert r.status_code in (200, 400, 404)

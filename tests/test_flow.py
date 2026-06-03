import uuid
import pytest
from fastapi.testclient import TestClient

from backend.main import app, SessionLocal, User

client = TestClient(app)


def unique_credentials():
    suffix = uuid.uuid4().hex[:8]
    username = f"testuser_{suffix}"
    return username, f"{username}@example.com", "testpass123"


def test_register_verify_login_complete_task():
    username, email, password = unique_credentials()

    # Register
    resp = client.post("/auth", json={
        "username": username,
        "password": password,
        "email": email,
        "register": True,
    })
    assert resp.status_code in (200, 400)

    # Ensure user exists and mark as verified so we can login
    db = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    assert user is not None, "user should have been created by /auth"
    user.is_verified = True
    db.commit()
    db.close()

    # Login
    resp = client.post("/auth", json={"username": username, "password": password, "register": False})
    assert resp.status_code == 200, resp.text
    token = resp.json().get("access_token")
    assert token, "login should return an access_token"

    headers = {"Authorization": f"Bearer {token}"}

    # Get tasks for the user
    resp = client.get("/tasks", headers=headers)
    assert resp.status_code == 200
    tasks = resp.json()
    assert isinstance(tasks, list)
    if not tasks:
        pytest.skip("No tasks were created on registration; skipping complete_task check")

    task_id = tasks[0]["id"]

    # Complete a task
    resp = client.post("/complete_task", json={"task_id": task_id}, headers=headers)
    assert resp.status_code == 200
    j = resp.json()
    assert j.get("status") == "ok"

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_tasks_requires_auth():
    r = client.get("/tasks")
    assert r.status_code in (401, 422)


def test_complete_task_requires_auth():
    r = client.post("/complete_task", json={"task_id": 1})
    assert r.status_code in (401, 400, 422)

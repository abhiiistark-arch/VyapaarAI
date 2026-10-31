from fastapi.testclient import TestClient

from app.main import app


def test_health():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_register_and_login():
    payload = {
        "full_name": "Asha Mehta",
        "email": "asha@example.com",
        "password": "strongpass",
        "business_name": "Mehta Dental",
        "role": "owner",
    }
    with TestClient(app) as client:
        register = client.post("/api/v1/auth/register", json=payload)
        assert register.status_code == 200, register.text
        token = register.json()["access_token"]
        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        body = me.json()
        assert body["user"]["email"] == "asha@example.com"
        assert body["tenant"]["name"] == "Mehta Dental"
        login = client.post(
            "/api/v1/auth/login", json={"email": "asha@example.com", "password": "strongpass"}
        )
        assert login.status_code == 200

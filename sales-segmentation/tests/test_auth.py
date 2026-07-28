"""Autentikasi, otorisasi, dan pengelolaan user."""

from __future__ import annotations

from tests.conftest import ADMIN, SALES


def test_login_berhasil(client):
    r = client.post("/api/auth/login", json=ADMIN)
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"


def test_login_password_salah(client):
    r = client.post("/api/auth/login", json={**ADMIN, "password": "salah"})
    assert r.status_code == 401


def test_pesan_login_tidak_membocorkan_email_terdaftar(client):
    """Email tak dikenal dan password salah harus memberi pesan yang sama."""
    tidak_dikenal = client.post(
        "/api/auth/login", json={"email": "bukan@indotek.co.id", "password": "apa-saja-123"}
    )
    password_salah = client.post("/api/auth/login", json={**ADMIN, "password": "salah-sekali"})
    assert tidak_dikenal.status_code == password_salah.status_code == 401
    assert tidak_dikenal.json()["detail"] == password_salah.json()["detail"]


def test_endpoint_butuh_token(client):
    assert client.get("/api/pipelines").status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_token_palsu_ditolak(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer bukan-token"})
    assert r.status_code == 401


def test_me(client, admin_headers):
    body = client.get("/api/auth/me", headers=admin_headers).json()
    assert body["email"] == ADMIN["email"]
    assert body["role"] == "admin"
    assert "hashed_password" not in body


def test_sales_tidak_boleh_kelola_user(client, sales_headers):
    assert client.get("/api/auth/users", headers=sales_headers).status_code == 403
    r = client.post(
        "/api/auth/users",
        headers=sales_headers,
        json={"email": "baru@indotek.co.id", "password": "password-123", "full_name": "Baru"},
    )
    assert r.status_code == 403


def test_admin_membuat_user(client, admin_headers):
    r = client.post(
        "/api/auth/users",
        headers=admin_headers,
        json={"email": "Baru@Indotek.co.id", "password": "password-123", "full_name": "User Baru"},
    )
    assert r.status_code == 201
    # Email disimpan lowercase agar login tidak sensitif huruf besar/kecil.
    assert r.json()["email"] == "baru@indotek.co.id"

    login = client.post(
        "/api/auth/login", json={"email": "BARU@indotek.co.id", "password": "password-123"}
    )
    assert login.status_code == 200


def test_email_ganda_ditolak(client, admin_headers):
    payload = {"email": SALES["email"], "password": "password-123", "full_name": "Duplikat"}
    assert client.post("/api/auth/users", headers=admin_headers, json=payload).status_code == 409


def test_password_pendek_ditolak(client, admin_headers):
    r = client.post(
        "/api/auth/users",
        headers=admin_headers,
        json={"email": "x@indotek.co.id", "password": "pendek", "full_name": "X"},
    )
    assert r.status_code == 422


def test_admin_tidak_bisa_menonaktifkan_diri_sendiri(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).json()
    r = client.patch(
        f"/api/auth/users/{me['id']}", headers=admin_headers, json={"is_active": False}
    )
    assert r.status_code == 400


def test_admin_tidak_bisa_menghapus_diri_sendiri(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).json()
    assert client.delete(f"/api/auth/users/{me['id']}", headers=admin_headers).status_code == 400


def test_user_nonaktif_tidak_bisa_login(client, admin_headers):
    users = client.get("/api/auth/users", headers=admin_headers).json()
    sales = next(u for u in users if u["email"] == SALES["email"])
    client.patch(f"/api/auth/users/{sales['id']}", headers=admin_headers, json={"is_active": False})

    assert client.post("/api/auth/login", json=SALES).status_code == 403


def test_ubah_password(client, sales_headers):
    r = client.post(
        "/api/auth/change-password",
        headers=sales_headers,
        json={"current_password": SALES["password"], "new_password": "password-baru-123"},
    )
    assert r.status_code == 204

    assert client.post("/api/auth/login", json=SALES).status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": SALES["email"], "password": "password-baru-123"}
    ).status_code == 200


def test_ubah_password_butuh_password_lama(client, sales_headers):
    r = client.post(
        "/api/auth/change-password",
        headers=sales_headers,
        json={"current_password": "bukan-yang-benar", "new_password": "password-baru-123"},
    )
    assert r.status_code == 400

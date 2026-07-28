"""
Pembatasan akses per peran.

Aturan yang diuji di sini menentukan siapa melihat data siapa, jadi setiap
kebocoran yang lolos akan berarti seorang Sales Executive bisa membaca pipeline
dan penilaian performa rekan kerjanya.
"""

from __future__ import annotations

import pytest

from app.models import Pipeline, Sales, User
from app.security import hash_password

ARI = "Ari Ardiansyah"
BUDI = "Budi Santoso"

ARI_LOGIN = {"email": "ari@indotek.co.id", "password": "password-ari-123"}
BUDI_LOGIN = {"email": "budi@indotek.co.id", "password": "password-budi-123"}
HEAD_LOGIN = {"email": "head@indotek.co.id", "password": "password-head-123"}


@pytest.fixture
def team(db_session):
    """Dua Sales Executive bertaut ke record Sales, plus seorang Head of Sales."""
    sales_records = {}
    for name in (ARI, BUDI):
        record = Sales(name=name, email=f"{name.split()[0].lower()}@indotek.co.id",
                       username=name.split()[0].lower(), status="Active")
        db_session.add(record)
        sales_records[name] = record
    db_session.flush()

    db_session.add_all([
        User(email=ARI_LOGIN["email"], hashed_password=hash_password(ARI_LOGIN["password"]),
             full_name=ARI, role="sales", sales_id=sales_records[ARI].id),
        User(email=BUDI_LOGIN["email"], hashed_password=hash_password(BUDI_LOGIN["password"]),
             full_name=BUDI, role="sales", sales_id=sales_records[BUDI].id),
        User(email=HEAD_LOGIN["email"], hashed_password=hash_password(HEAD_LOGIN["password"]),
             full_name="Head of Sales", role="head_sales"),
    ])

    # Tiap sales punya deal sendiri, ditambah satu sales ketiga tanpa akun agar
    # data tim tetap cukup untuk clustering (butuh minimal 3 sales).
    for owner, jumlah in ((ARI, 4), (BUDI, 3), ("Citra Dewi", 3)):
        for i in range(jumlah):
            db_session.add(
                Pipeline(
                    customer=f"PT {owner.split()[0]} {i}",
                    project_name="Proyek",
                    stage=["Leads", "Won", "Lost", "Hold"][i % 4],
                    sales_name=owner,
                    quarter="Q1",
                    year=2025,
                    estimated_value=100_000_000,
                )
            )
    db_session.commit()
    return db_session


def headers(client, credentials):
    token = client.post("/api/auth/login", json=credentials).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------- #
# Sales Executive: hanya datanya sendiri
# --------------------------------------------------------------------------- #
def test_sales_hanya_melihat_pipeline_sendiri(client, team):
    rows = client.get("/api/pipelines", headers=headers(client, ARI_LOGIN)).json()
    assert len(rows) == 4
    assert {row["sales_name"] for row in rows} == {ARI}


def test_sales_tidak_bisa_mengintip_lewat_parameter(client, team):
    """Mengisi sales_name dengan nama rekan tidak boleh membuka datanya."""
    rows = client.get(
        "/api/pipelines", headers=headers(client, ARI_LOGIN), params={"sales_name": BUDI}
    ).json()
    assert all(row["sales_name"] == ARI for row in rows)


def test_head_sales_melihat_seluruh_tim(client, team):
    rows = client.get("/api/pipelines", headers=headers(client, HEAD_LOGIN)).json()
    assert len(rows) == 10
    assert {row["sales_name"] for row in rows} == {ARI, BUDI, "Citra Dewi"}


def test_sales_tidak_bisa_membaca_pipeline_rekan(client, team):
    budi_rows = client.get("/api/pipelines", headers=headers(client, BUDI_LOGIN)).json()
    target = budi_rows[0]["id"]

    # 404, bukan 403: 403 sudah membocorkan bahwa record dengan id itu ada.
    r = client.patch(
        f"/api/pipelines/{target}", headers=headers(client, ARI_LOGIN), json={"stage": "Won"}
    )
    assert r.status_code == 404


def test_sales_tidak_bisa_menghapus_pipeline_rekan(client, team):
    budi_rows = client.get("/api/pipelines", headers=headers(client, BUDI_LOGIN)).json()
    r = client.delete(f"/api/pipelines/{budi_rows[0]['id']}", headers=headers(client, ARI_LOGIN))
    assert r.status_code == 404

    # Pastikan benar-benar masih ada.
    assert len(client.get("/api/pipelines", headers=headers(client, BUDI_LOGIN)).json()) == 3


def test_pipeline_baru_selalu_atas_nama_pembuatnya(client, team):
    """Sales tidak bisa membuat pipeline atas nama orang lain."""
    created = client.post(
        "/api/pipelines",
        headers=headers(client, ARI_LOGIN),
        json={"customer": "PT Baru", "project_name": "Proyek", "sales_name": BUDI},
    ).json()
    assert created["sales_name"] == ARI


def test_sales_tidak_bisa_memindahkan_pipeline_ke_rekan(client, team):
    rows = client.get("/api/pipelines", headers=headers(client, ARI_LOGIN)).json()
    updated = client.patch(
        f"/api/pipelines/{rows[0]['id']}",
        headers=headers(client, ARI_LOGIN),
        json={"sales_name": BUDI, "stage": "Won"},
    ).json()
    assert updated["sales_name"] == ARI   # perpindahan diabaikan
    assert updated["stage"] == "Won"      # perubahan lain tetap berlaku


def test_head_sales_boleh_menugaskan_pipeline(client, team):
    created = client.post(
        "/api/pipelines",
        headers=headers(client, HEAD_LOGIN),
        json={"customer": "PT Baru", "project_name": "Proyek", "sales_name": BUDI},
    ).json()
    assert created["sales_name"] == BUDI


# --------------------------------------------------------------------------- #
# Segmentasi
# --------------------------------------------------------------------------- #
def test_sales_tidak_boleh_menjalankan_segmentasi(client, team):
    r = client.post(
        "/api/segmentation/run",
        headers=headers(client, ARI_LOGIN),
        json={"quarter": "Q1", "year": 2025},
    )
    assert r.status_code == 403


def test_head_sales_boleh_menjalankan_segmentasi(client, team):
    r = client.post(
        "/api/segmentation/run",
        headers=headers(client, HEAD_LOGIN),
        json={"quarter": "Q1", "year": 2025},
    )
    assert r.status_code == 200


def test_sales_hanya_melihat_hasil_segmentasi_dirinya(client, team):
    client.post(
        "/api/segmentation/run",
        headers=headers(client, HEAD_LOGIN),
        json={"quarter": "Q1", "year": 2025},
    )

    milik_ari = client.get("/api/segmentation/results", headers=headers(client, ARI_LOGIN)).json()
    assert len(milik_ari) == 1
    assert milik_ari[0]["sales_name"] == ARI

    seluruhnya = client.get(
        "/api/segmentation/results", headers=headers(client, HEAD_LOGIN)
    ).json()
    assert len(seluruhnya) == 3


def test_sales_tidak_boleh_sweep_k(client, team):
    r = client.post(
        "/api/segmentation/sweep-k",
        headers=headers(client, ARI_LOGIN),
        json={"quarter": "Q1", "year": 2025},
    )
    assert r.status_code == 403


# --------------------------------------------------------------------------- #
# Master data & pengelolaan akun
# --------------------------------------------------------------------------- #
def test_sales_tidak_boleh_impor_massal(client, team):
    from io import BytesIO
    r = client.post(
        "/api/uploads/preview",
        headers=headers(client, ARI_LOGIN),
        files={"file": ("data.csv", BytesIO(b"Customer,Project Name\nA,B\n"), "text/csv")},
    )
    assert r.status_code == 403


def test_head_sales_boleh_impor_massal(client, team):
    from io import BytesIO
    r = client.post(
        "/api/uploads/preview",
        headers=headers(client, HEAD_LOGIN),
        files={"file": ("data.csv", BytesIO(b"Customer,Project Name\nA,B\n"), "text/csv")},
    )
    assert r.status_code == 200


def test_head_sales_tidak_boleh_kelola_akun(client, team):
    """Head of Sales memimpin tim, bukan mengelola akses sistem."""
    assert client.get("/api/auth/users", headers=headers(client, HEAD_LOGIN)).status_code == 403


def test_head_sales_boleh_ubah_master_sales(client, team):
    r = client.post(
        "/api/sales",
        headers=headers(client, HEAD_LOGIN),
        json={"name": "Sales Baru", "email": "baru@indotek.co.id", "username": "baru"},
    )
    assert r.status_code == 201


def test_sales_tanpa_tautan_ditolak_dengan_pesan_jelas(client, db_session, admin_headers):
    """
    Akun sales yang belum ditautkan tidak boleh diam-diam melihat data tim.
    Menolak lebih aman daripada menampilkan segalanya.
    """
    db_session.add(
        User(
            email="lepas@indotek.co.id",
            hashed_password=hash_password("password-lepas-123"),
            full_name="Belum Ditautkan",
            role="sales",
            sales_id=None,
        )
    )
    db_session.commit()

    r = client.get(
        "/api/pipelines",
        headers=headers(client, {"email": "lepas@indotek.co.id", "password": "password-lepas-123"}),
    )
    assert r.status_code == 403
    assert "belum ditautkan" in r.json()["detail"].lower()


def test_role_tidak_dikenal_ditolak(client, admin_headers):
    r = client.post(
        "/api/auth/users",
        headers=admin_headers,
        json={
            "email": "x@indotek.co.id", "password": "password-123",
            "full_name": "X", "role": "direktur",
        },
    )
    assert r.status_code == 422


def test_admin_terakhir_tidak_bisa_diturunkan(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).json()
    # Admin tidak bisa menurunkan dirinya sendiri…
    assert client.patch(
        f"/api/auth/users/{me['id']}", headers=admin_headers, json={"role": "head_sales"}
    ).status_code == 400

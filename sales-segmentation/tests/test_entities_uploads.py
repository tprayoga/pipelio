"""CRUD entity dan impor file Excel/CSV."""

from __future__ import annotations

from io import BytesIO

import pandas as pd


def _upload(client, headers, df, filename="data.xlsx"):
    buffer = BytesIO()
    if filename.endswith(".csv"):
        df.to_csv(buffer, index=False)
        content_type = "text/csv"
    else:
        df.to_excel(buffer, index=False)
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    buffer.seek(0)
    return client.post(
        "/api/uploads/preview",
        headers=headers,
        files={"file": (filename, buffer, content_type)},
    )


# --------------------------------------------------------------------------- #
# Entity
# --------------------------------------------------------------------------- #
def test_crud_pipeline(client, admin_headers):
    created = client.post(
        "/api/pipelines",
        headers=admin_headers,
        json={
            "customer": "PT Uji", "project_name": "Proyek A", "stage": "Leads",
            "estimated_value": 50_000_000, "quarter": "Q1", "year": 2025,
            "sales_name": "Ari",
        },
    )
    assert created.status_code == 201
    pipeline_id = created.json()["id"]

    updated = client.patch(
        f"/api/pipelines/{pipeline_id}", headers=admin_headers, json={"stage": "Won"}
    )
    assert updated.json()["stage"] == "Won"

    assert client.delete(f"/api/pipelines/{pipeline_id}", headers=admin_headers).status_code == 204
    assert client.patch(
        f"/api/pipelines/{pipeline_id}", headers=admin_headers, json={"stage": "Lost"}
    ).status_code == 404


def test_stage_tidak_dikenal_ditolak(client, admin_headers):
    r = client.post(
        "/api/pipelines",
        headers=admin_headers,
        json={"customer": "PT Uji", "project_name": "P", "stage": "Entahlah"},
    )
    assert r.status_code == 422


def test_filter_pipeline_di_server(client, admin_headers):
    """
    Filter periode dikerjakan database, bukan dengan mengambil N terbaru lalu
    memilah di browser — cara lama membuat quarter tertua tak pernah terambil.
    """
    for quarter in ("Q1", "Q2"):
        for i in range(3):
            client.post(
                "/api/pipelines",
                headers=admin_headers,
                json={
                    "customer": f"PT {quarter}{i}", "project_name": "P",
                    "quarter": quarter, "year": 2025, "stage": "Leads",
                },
            )

    q1 = client.get("/api/pipelines", headers=admin_headers, params={"quarter": "Q1", "year": 2025})
    assert len(q1.json()) == 3
    assert all(row["quarter"] == "Q1" for row in q1.json())


def test_sort_kolom_tidak_dikenal_ditolak(client, admin_headers):
    r = client.get("/api/pipelines", headers=admin_headers, params={"sort": "kolom_ngawur"})
    assert r.status_code == 400


def test_sales_tidak_boleh_membuat_master_sales(client, sales_headers):
    r = client.post(
        "/api/sales",
        headers=sales_headers,
        json={"name": "X", "email": "x@indotek.co.id", "username": "x"},
    )
    assert r.status_code == 403


def test_entity_butuh_login(client):
    assert client.get("/api/customers").status_code == 401
    assert client.get("/api/sales").status_code == 401


# --------------------------------------------------------------------------- #
# Upload
# --------------------------------------------------------------------------- #
def test_preview_dan_import(client, admin_headers):
    df = pd.DataFrame({
        "Customer": ["PT Alpha", "PT Beta"],
        "Project Name": ["Server", "Jaringan"],
        "Stage": ["Won", "negosiasi"],
        "Sales Executive": ["Ari", "Budi"],
        "Quarter": ["Q1", "Q2"],
        "Year": [2025, 2025],
        "Nilai": [100_000_000, 250_000_000],
    })
    preview = _upload(client, admin_headers, df)
    assert preview.status_code == 200
    rows = preview.json()["rows"]
    assert preview.json()["total"] == 2
    # Alias kolom dan nilai stage berbahasa Indonesia harus dikenali.
    assert rows[0]["stage"] == "Won"
    assert rows[1]["stage"] == "Negotiating"
    assert rows[0]["estimated_value"] == 100_000_000

    imported = client.post("/api/uploads/import", headers=admin_headers, json={"rows": rows})
    assert imported.json()["imported"] == 2

    stored = client.get("/api/pipelines", headers=admin_headers).json()
    assert len(stored) == 2


def test_preview_csv(client, admin_headers):
    df = pd.DataFrame({"Customer": ["PT Alpha"], "Project Name": ["Server"]})
    r = _upload(client, admin_headers, df, filename="data.csv")
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_kolom_wajib_tidak_ada(client, admin_headers):
    df = pd.DataFrame({"Sesuatu": [1], "Lainnya": [2]})
    r = _upload(client, admin_headers, df)
    assert r.status_code == 400
    assert "wajib" in r.json()["detail"].lower()


def test_baris_tanpa_customer_dilewati(client, admin_headers):
    df = pd.DataFrame({
        "Customer": ["PT Alpha", None, ""],
        "Project Name": ["Server", "Kosong", "Kosong"],
    })
    body = _upload(client, admin_headers, df).json()
    assert body["total"] == 1
    assert any("dilewati" in w for w in body["warnings"])


def test_stage_tak_dikenal_jadi_leads_dengan_peringatan(client, admin_headers):
    df = pd.DataFrame({
        "Customer": ["PT Alpha"], "Project Name": ["Server"], "Stage": ["Antah Berantah"],
    })
    body = _upload(client, admin_headers, df).json()
    assert body["rows"][0]["stage"] == "Leads"
    assert any("stage" in w.lower() for w in body["warnings"])


def test_format_file_ditolak(client, admin_headers):
    r = client.post(
        "/api/uploads/preview",
        headers=admin_headers,
        files={"file": ("catatan.txt", BytesIO(b"halo"), "text/plain")},
    )
    assert r.status_code == 400


def test_upload_butuh_login(client):
    r = client.post(
        "/api/uploads/preview",
        files={"file": ("data.csv", BytesIO(b"Customer,Project Name\nA,B\n"), "text/csv")},
    )
    assert r.status_code == 401


# --------------------------------------------------------------------------- #
# Template
# --------------------------------------------------------------------------- #
def test_template_bisa_diunduh(client, admin_headers):
    r = client.get("/api/uploads/template", headers=admin_headers)
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
    assert "template_pipeline_pipelio.xlsx" in r.headers["content-disposition"]
    assert len(r.content) > 1000


def test_template_bisa_diunggah_balik_tanpa_peringatan(client, admin_headers):
    """
    Template yang kita berikan harus lolos parser kita sendiri.

    Kalau ada satu judul kolom yang tak dikenali, pengguna akan menerima
    peringatan "kolom diabaikan" atas berkas yang justru kita sediakan.
    """
    template = client.get("/api/uploads/template", headers=admin_headers).content

    preview = client.post(
        "/api/uploads/preview",
        headers=admin_headers,
        files={"file": ("template.xlsx", BytesIO(template), "application/vnd.ms-excel")},
    )
    assert preview.status_code == 200
    body = preview.json()

    assert body["warnings"] == []
    assert body["total"] == 2      # dua baris contoh

    baris = body["rows"][0]
    assert baris["customer"] == "PT Sinar Baja Elektrik"
    assert baris["stage"] == "Won"
    assert baris["quarter"] == "Q1"
    assert baris["year"] == 2025
    assert baris["estimated_value"] == 250_000_000


def test_baris_contoh_template_benar_benar_bisa_diimpor(client, admin_headers):
    template = client.get("/api/uploads/template", headers=admin_headers).content
    rows = client.post(
        "/api/uploads/preview",
        headers=admin_headers,
        files={"file": ("template.xlsx", BytesIO(template), "application/vnd.ms-excel")},
    ).json()["rows"]

    assert client.post(
        "/api/uploads/import", headers=admin_headers, json={"rows": rows}
    ).json()["imported"] == 2


def test_template_hanya_untuk_pengelola_data(client, sales_headers):
    assert client.get("/api/uploads/template", headers=sales_headers).status_code == 403


def test_template_butuh_login(client):
    assert client.get("/api/uploads/template").status_code == 401

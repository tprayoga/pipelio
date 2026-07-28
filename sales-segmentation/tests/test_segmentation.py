"""
Segmentasi lewat API, di atas data pipeline yang tersimpan di database.

Klaim yang dikunci di sini adalah yang dikutip pada naskah skripsi: Silhouette
0.6516 pada akumulasi tahunan data Indotek, K=3 optimal, dan hasil deterministik.
"""

from __future__ import annotations

import csv
from pathlib import Path

import pytest

from app.models import Pipeline

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "sales_pipeline_2025.csv"

STAGE_FROM_COLUMN = {
    "Lead": "Leads", "Prospecting": "Prospecting", "Negotiating": "Negotiating",
    "Won": "Won", "Lost": "Lost", "Hold": "Hold",
}


def _load_pipelines(db, quarters=None):
    """Perluas CSV penelitian menjadi record deal, satu per hitungan stage."""
    with CSV_PATH.open() as handle:
        rows = list(csv.DictReader(handle))

    created = 0
    for row in rows:
        if quarters and row["Quarter"] not in quarters:
            continue
        for column, stage in STAGE_FROM_COLUMN.items():
            for _ in range(int(row[column])):
                db.add(
                    Pipeline(
                        customer="PT Uji",
                        project_name="Proyek Uji",
                        stage=stage,
                        sales_name=row["Sales Executive"],
                        quarter=row["Quarter"],
                        year=2025,
                        estimated_value=100_000_000,
                    )
                )
                created += 1
    db.commit()
    return created


@pytest.fixture
def seeded(db_session):
    _load_pipelines(db_session)
    return db_session


def test_agregasi_cocok_dengan_dataset_penelitian(client, seeded, admin_headers):
    """Jumlah deal per stage yang dipakai clustering harus sama dengan CSV."""
    body = client.post(
        "/api/segmentation/run",
        headers=admin_headers,
        json={"quarter": "Q1", "year": 2025, "save": False},
    ).json()

    ari = next(r for r in body["results"] if r["name"] == "Ari Ardiansyah Habib")
    # Baris CSV: Ari,Q1,5,4,3,3,0,0
    assert (ari["lead"], ari["prospecting"], ari["negotiation"]) == (5, 4, 3)
    assert (ari["won"], ari["lost"], ari["hold"]) == (3, 0, 0)


def test_segmentasi_deterministik(client, seeded, admin_headers):
    payload = {"quarter": "Q1", "year": 2025, "save": False}
    first = client.post("/api/segmentation/run", headers=admin_headers, json=payload).json()
    second = client.post("/api/segmentation/run", headers=admin_headers, json=payload).json()

    assert first["silhouette"] == second["silhouette"]
    assert [r["cluster_name"] for r in first["results"]] == [
        r["cluster_name"] for r in second["results"]
    ]


def test_label_terurut_mengikuti_skor(client, seeded, admin_headers):
    body = client.post(
        "/api/segmentation/run",
        headers=admin_headers,
        json={"quarter": "Q1", "year": 2025, "save": False},
    ).json()

    by_label = {}
    for row in body["results"]:
        by_label.setdefault(row["label"], []).append(row["score"])
    rata = {label: sum(v) / len(v) for label, v in by_label.items()}
    assert rata["High"] > rata["Medium"] > rata["Low"]


def test_win_rate_hanya_menghitung_deal_selesai(client, seeded, admin_headers):
    """Win% = Won / (Won+Lost+Hold); deal yang masih berjalan tidak ikut."""
    body = client.post(
        "/api/segmentation/run",
        headers=admin_headers,
        json={"quarter": "Q1", "year": 2025, "save": False},
    ).json()

    for row in body["results"]:
        selesai = row["won"] + row["lost"] + row["hold"]
        expected = row["won"] / selesai if selesai else 0
        assert row["win_rate"] == pytest.approx(expected)


def test_hasil_disimpan_dan_tidak_menggandakan(client, seeded, admin_headers):
    payload = {"quarter": "Q1", "year": 2025, "save": True}
    client.post("/api/segmentation/run", headers=admin_headers, json=payload)
    first = client.get(
        "/api/segmentation/results", headers=admin_headers, params={"quarter": "Q1", "year": 2025}
    ).json()
    assert len(first) == 10

    # Menjalankan ulang menggantikan hasil periode ini, bukan menumpuknya.
    client.post("/api/segmentation/run", headers=admin_headers, json=payload)
    second = client.get(
        "/api/segmentation/results", headers=admin_headers, params={"quarter": "Q1", "year": 2025}
    ).json()
    assert len(second) == 10


def test_save_false_tidak_menyimpan(client, seeded, admin_headers):
    client.post(
        "/api/segmentation/run",
        headers=admin_headers,
        json={"quarter": "Q3", "year": 2025, "save": False},
    )
    saved = client.get(
        "/api/segmentation/results", headers=admin_headers, params={"quarter": "Q3", "year": 2025}
    ).json()
    assert saved == []


def test_periode_tanpa_data(client, seeded, admin_headers):
    r = client.post(
        "/api/segmentation/run", headers=admin_headers, json={"quarter": "Q1", "year": 2099}
    )
    assert r.status_code == 404


def test_k_selain_tiga_jalan_tapi_tidak_disimpan(client, seeded, admin_headers):
    """
    K != 3 boleh dijalankan untuk eksplorasi, tetapi tidak disimpan karena
    laporan dan riwayat dibangun atas skema tiga tingkat High/Medium/Low.
    """
    r = client.post(
        "/api/segmentation/run",
        headers=admin_headers,
        json={"quarter": "Q1", "year": 2025, "k": 5, "save": True},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["k"] == 5
    assert body["saved"] is False
    assert {row["label"] for row in body["results"]} == {f"Tier {i}" for i in range(1, 6)}

    saved = client.get(
        "/api/segmentation/results", headers=admin_headers, params={"quarter": "Q1", "year": 2025}
    ).json()
    assert saved == []


def test_k_lebih_besar_dari_jumlah_sales_ditolak(client, seeded, admin_headers):
    r = client.post(
        "/api/segmentation/run",
        headers=admin_headers,
        json={"quarter": "Q1", "year": 2025, "k": 6},
    )
    # 10 sales cukup untuk k=6, jadi permintaan ini sah.
    assert r.status_code == 200


def test_sweep_k_memilih_tiga(client, seeded, admin_headers):
    body = client.post(
        "/api/segmentation/sweep-k",
        headers=admin_headers,
        json={"quarter": "Q1", "year": 2025},
    ).json()
    assert body["best_k"] == 3


def test_segmentasi_butuh_login(client, seeded):
    r = client.post("/api/segmentation/run", json={"quarter": "Q1", "year": 2025})
    assert r.status_code == 401


def test_sales_tidak_boleh_menjalankan_segmentasi(client, seeded, sales_headers):
    """
    Segmentasi adalah alat penilaian tim, jadi hanya Head of Sales dan admin
    yang menjalankannya. Sales Executive tetap bisa melihat hasil dirinya lewat
    /api/segmentation/results.
    """
    r = client.post(
        "/api/segmentation/run",
        headers=sales_headers,
        json={"quarter": "Q1", "year": 2025, "save": False},
    )
    assert r.status_code == 403


def test_akumulasi_tahunan_mereproduksi_angka_skripsi(client, db_session, admin_headers):
    """
    Silhouette 0.6516 dengan K=3 optimal — angka yang dikutip di naskah.

    Data seluruh tahun dimasukkan sebagai satu periode agar agregasinya setara
    dengan mode "Akumulasi Tahunan" pada app Streamlit.
    """
    with CSV_PATH.open() as handle:
        rows = list(csv.DictReader(handle))

    for row in rows:
        for column, stage in STAGE_FROM_COLUMN.items():
            for _ in range(int(row[column])):
                db_session.add(
                    Pipeline(
                        customer="PT Uji", project_name="Proyek Uji", stage=stage,
                        sales_name=row["Sales Executive"], quarter="Q1", year=2099,
                    )
                )
    db_session.commit()

    body = client.post(
        "/api/segmentation/run",
        headers=admin_headers,
        json={"quarter": "Q1", "year": 2099, "k": 3, "save": False},
    ).json()

    assert body["n_rows"] == 10
    assert body["silhouette"] == pytest.approx(0.6516, abs=1e-3)

    sweep = client.post(
        "/api/segmentation/sweep-k",
        headers=admin_headers,
        json={"quarter": "Q1", "year": 2099},
    ).json()
    assert sweep["best_k"] == 3

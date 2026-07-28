"""
Mengisi database dengan data contoh dari dataset penelitian.

Untuk demo, pelatihan, dan pengembangan lokal — JANGAN dijalankan pada database
produksi yang sudah berisi data asli. Skrip menolak jalan bila tabel pipeline
sudah terisi, kecuali dipaksa dengan --force.

    python -m app.seed            isi bila masih kosong
    python -m app.seed --force    hapus data lama, isi ulang
"""

from __future__ import annotations

import argparse
import csv
import random
import sys
from pathlib import Path

from sqlalchemy import delete, func, select

from app.config import get_settings
from app.db import SessionLocal
from app.models import ClusteringResult, Customer, Pipeline, Sales, User
from app.security import hash_password

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "sales_pipeline_2025.csv"
YEAR = 2025

STAGE_FROM_COLUMN = {
    "Lead": "Leads", "Prospecting": "Prospecting", "Negotiating": "Negotiating",
    "Won": "Won", "Lost": "Lost", "Hold": "Hold",
}
STATUS_FROM_STAGE = {"Won": "Closed", "Lost": "Closed", "Hold": "On Hold"}
QUARTER_MONTHS = {"Q1": (1, 3), "Q2": (4, 6), "Q3": (7, 9), "Q4": (10, 12)}

COMPANIES = [
    ("PT Sinar Baja Elektrik", "Manufaktur"), ("PT Mitra Adiperkasa", "Retail"),
    ("PT Bank Artha Graha", "Perbankan"), ("RS Premier Bintaro", "Kesehatan"),
    ("PT Telkom Akses", "Telekomunikasi"), ("Universitas Bina Nusantara", "Pendidikan"),
    ("PT Astra Otoparts", "Otomotif"), ("PT Pupuk Kujang", "Kimia"),
    ("PT Angkasa Pura II", "Transportasi"), ("PT Indofood Sukses Makmur", "FMCG"),
    ("PT Semen Indonesia", "Konstruksi"), ("PT Pelindo Marine", "Logistik"),
    ("Pemkot Bandung", "Pemerintahan"), ("PT Kalbe Farma", "Farmasi"),
    ("PT Garuda Metalindo", "Manufaktur"),
]
PROJECTS = [
    ("Pengadaan Server Rack", "Hardware"), ("Implementasi Jaringan Fiber", "Infrastruktur"),
    ("Upgrade CCTV Terpadu", "Security"), ("Instalasi UPS Data Center", "Hardware"),
    ("Migrasi Cloud Private", "Cloud"), ("Pengadaan Access Point", "Networking"),
    ("Sistem Absensi Biometrik", "Software"), ("Perangkat Video Conference", "Multimedia"),
    ("Maintenance Kontrak Tahunan", "Layanan"), ("Pengadaan Laptop Karyawan", "Hardware"),
    ("Firewall & Endpoint Security", "Security"), ("Storage NAS Enterprise", "Hardware"),
]
PIC_FIRST = ["Andi", "Rina", "Dewi", "Bagus", "Sri", "Hendra", "Maya", "Yusuf", "Lestari", "Fajar"]
PIC_LAST = ["Wijaya", "Kusuma", "Pratama", "Halim", "Nugroho", "Saputra", "Anggraini", "Setiawan"]


def seed(force: bool = False) -> int:
    settings = get_settings()

    if not CSV_PATH.exists():
        print(f"Dataset tidak ditemukan: {CSV_PATH}", file=sys.stderr)
        return 1

    rng = random.Random(2025)  # deterministik -> hasil seed selalu sama

    with SessionLocal() as db:
        existing = db.scalar(select(func.count()).select_from(Pipeline))
        if existing and not force:
            print(f"Database sudah berisi {existing} pipeline. Gunakan --force untuk isi ulang.")
            return 0

        if force and existing:
            print(f"Menghapus {existing} pipeline lama beserta hasil clustering…")
            db.execute(delete(ClusteringResult))
            db.execute(delete(Pipeline))
            db.execute(delete(Customer))
            db.execute(delete(Sales))
            db.commit()

        with CSV_PATH.open() as handle:
            rows = list(csv.DictReader(handle))

        customers = {}
        for company, industry in COMPANIES:
            slug = company.lower().replace("pt ", "").replace(" ", "")[:14]
            customer = Customer(
                company=company,
                pic=f"{rng.choice(PIC_FIRST)} {rng.choice(PIC_LAST)}",
                email=f"procurement@{slug}.co.id",
                phone=f"021-{rng.randint(3000, 8999)}{rng.randint(100, 999)}",
                industry=industry,
                address=f"Jl. {rng.choice(['Sudirman', 'Gatot Subroto', 'MH Thamrin'])} "
                        f"No.{rng.randint(1, 199)}, Jakarta",
            )
            customers[company] = customer
            db.add(customer)

        sales_names = sorted({row["Sales Executive"] for row in rows})
        for name in sales_names:
            username = name.lower().split()[0]
            db.add(
                Sales(
                    name=name,
                    email=f"{username}@indotek.co.id",
                    username=username,
                    status="Active",
                    phone=f"08{rng.randint(10, 99)}{rng.randint(1000000, 9999999)}",
                    target=rng.randrange(2, 6) * 1_000_000_000,
                )
            )

        pipelines = []
        for row in rows:
            sales_name = row["Sales Executive"]
            quarter = row["Quarter"]
            start_month, end_month = QUARTER_MONTHS[quarter]

            for column, stage in STAGE_FROM_COLUMN.items():
                for _ in range(int(row[column])):
                    company, industry = rng.choice(COMPANIES)
                    project, category = rng.choice(PROJECTS)
                    month = rng.randint(start_month, end_month)
                    pipelines.append(
                        Pipeline(
                            customer=company,
                            company=company,
                            industry=industry,
                            project_name=f"{project} — {company.replace('PT ', '')}",
                            project_category=category,
                            estimated_value=rng.randrange(25, 851) * 1_000_000,
                            estimated_closing=f"{YEAR}-{month:02d}-{rng.randint(1, 28):02d}",
                            pic=customers[company].pic,
                            email=customers[company].email,
                            phone=customers[company].phone,
                            stage=stage,
                            sales_name=sales_name,
                            quarter=quarter,
                            year=YEAR,
                            status=STATUS_FROM_STAGE.get(stage, "Active"),
                        )
                    )
        db.add_all(pipelines)

        if not db.scalar(select(func.count()).select_from(User)):
            db.add(
                User(
                    email=settings.first_admin_email.lower(),
                    hashed_password=hash_password(settings.first_admin_password),
                    full_name=settings.first_admin_name,
                    role="admin",
                )
            )
            print(f"  Admin dibuat: {settings.first_admin_email}")

        db.commit()

        print(f"✓ {len(pipelines)} pipeline · {len(customers)} customer · {len(sales_names)} sales")
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="hapus data lama lalu isi ulang")
    raise SystemExit(seed(force=parser.parse_args().force))

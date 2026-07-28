"""
Membuat akun admin pertama bila database belum punya user sama sekali.

Dijalankan tiap kali container start. Aman diulang: begitu ada satu user,
skrip ini tidak melakukan apa pun — jadi password admin yang sudah diganti
tidak akan tertimpa kembali ke nilai di .env.
"""

from __future__ import annotations

import sys

from sqlalchemy import func, select

from app.config import get_settings
from app.db import SessionLocal
from app.models import User
from app.security import hash_password

WEAK_DEFAULT = "ubah-password-ini"


def main() -> int:
    settings = get_settings()

    with SessionLocal() as db:
        existing = db.scalar(select(func.count()).select_from(User))
        if existing:
            print(f"  {existing} user sudah ada — admin tidak dibuat ulang.")
            return 0

        if settings.is_production and settings.first_admin_password == WEAK_DEFAULT:
            print(
                "  GAGAL: FIRST_ADMIN_PASSWORD masih memakai nilai default.\n"
                "  Isi dengan password yang kuat di .env sebelum menjalankan di produksi.",
                file=sys.stderr,
            )
            return 1

        db.add(
            User(
                email=settings.first_admin_email.lower(),
                hashed_password=hash_password(settings.first_admin_password),
                full_name=settings.first_admin_name,
                role="admin",
                is_active=True,
            )
        )
        db.commit()
        print(f"  Admin dibuat: {settings.first_admin_email}")
        print("  Segera ganti passwordnya setelah login pertama.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

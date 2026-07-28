"""peran head_sales dan tautan sales

Menambahkan peran Head of Sales dan indeks untuk penautan akun ke data sales.

Peran disimpan sebagai string biasa, bukan enum Postgres: menambah nilai enum
memerlukan ALTER TYPE yang tidak bisa dibatalkan dengan rapi, sementara daftar
peran di sini masih mungkin berkembang.

Data lama tidak berubah nilainya — akun ber-role "admin" dan "sales" tetap sah.
Yang dibatasi hanya nilai yang boleh masuk setelah ini.

Revision ID: 504cdc2e50f4
Revises: f328c87a1167
"""

from typing import Sequence, Union

from alembic import op

revision: str = "504cdc2e50f4"
down_revision: Union[str, None] = "f328c87a1167"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Pembatasan di level database, bukan hanya di Pydantic: kalau nanti ada
    # skrip atau perbaikan manual yang menulis langsung ke tabel, peran ngawur
    # tetap tertolak.
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('admin', 'head_sales', 'sales')",
    )

    # Pencarian "akun ini tertaut ke sales mana" dilakukan pada tiap permintaan
    # dari Sales Executive.
    op.create_index("ix_users_sales_id", "users", ["sales_id"])


def downgrade() -> None:
    op.drop_index("ix_users_sales_id", table_name="users")
    op.drop_constraint("ck_users_role", "users", type_="check")

    # Peran head_sales tidak dikenal skema lama; turunkan ke sales agar akunnya
    # tetap bisa dipakai alih-alih menyisakan nilai yang tak terbaca.
    op.execute("UPDATE users SET role = 'sales' WHERE role = 'head_sales'")

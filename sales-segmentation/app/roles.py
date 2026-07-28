"""
Peran pengguna dan aturan aksesnya.

Dikumpulkan di satu tempat supaya "siapa boleh apa" bisa dibaca sekali jalan,
bukan tersebar sebagai pengecekan `if role == ...` di banyak router.

  admin       — administrator sistem: seluruh data + kelola akun pengguna.
  head_sales  — Head of Sales: seluruh data tim, menjalankan segmentasi,
                mengelola master sales. Tidak mengelola akun.
  sales       — Sales Executive: hanya pipeline miliknya sendiri. Boleh melihat
                hasil segmentasi dirinya, tidak melihat peringkat rekan.
"""

from __future__ import annotations

ADMIN = "admin"
HEAD_SALES = "head_sales"
SALES = "sales"

ALL_ROLES = (ADMIN, HEAD_SALES, SALES)

ROLE_LABELS = {
    ADMIN: "Administrator",
    HEAD_SALES: "Head of Sales",
    SALES: "Sales Executive",
}

# Peran yang melihat data seluruh tim. Sisanya dibatasi pada datanya sendiri.
TEAM_WIDE = frozenset({ADMIN, HEAD_SALES})

# Peran yang boleh menjalankan proses segmentasi dan melihat hasil seluruh tim.
CAN_RUN_SEGMENTATION = frozenset({ADMIN, HEAD_SALES})

# Peran yang boleh mengubah data master sales dan mengimpor data massal.
CAN_MANAGE_MASTER_DATA = frozenset({ADMIN, HEAD_SALES})

# Pengelolaan akun pengguna.
CAN_MANAGE_USERS = frozenset({ADMIN})


def sees_all_data(role: str) -> bool:
    return role in TEAM_WIDE

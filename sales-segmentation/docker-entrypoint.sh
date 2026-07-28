#!/bin/sh
# Jalankan migrasi lalu bootstrap akun admin pertama, baru start server.
#
# `alembic upgrade head` aman dijalankan berulang: migrasi yang sudah pernah
# diterapkan akan dilewati, jadi restart container tidak merusak data.
set -e

echo "▸ Menjalankan migrasi database…"
alembic upgrade head

echo "▸ Memastikan akun admin tersedia…"
python -m app.bootstrap

echo "▸ Menjalankan server…"
exec "$@"

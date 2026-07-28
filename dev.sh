#!/usr/bin/env bash
# Menjalankan Pipelio untuk PENGEMBANGAN (hot reload).
#
#   ./dev.sh setup    sekali saja: venv, dependency, database dev
#   ./dev.sh          jalankan backend + frontend
#   ./dev.sh seed     isi database dev dengan data contoh
#
# Untuk PRODUKSI pakai Docker Compose:  docker compose up -d --build
#
# Database dev berjalan di container Postgres terpisah (port 55432) supaya tidak
# bentrok dengan Postgres milik stack produksi.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/sales-segmentation"
WEB_DIR="$ROOT/Project Pipeline"
VENV="$API_DIR/.venv"

PG_CONTAINER="pipelio-pg-dev"
PG_PORT=55432
API_PORT="${API_PORT:-8000}"

export DATABASE_URL="postgresql+psycopg://pipelio:devpass@localhost:${PG_PORT}/pipelio"
export SECRET_KEY="${SECRET_KEY:-kunci-pengembangan-lokal-jangan-dipakai-di-produksi}"
export APP_ENV="development"
export CORS_ORIGINS=""
export FIRST_ADMIN_EMAIL="${FIRST_ADMIN_EMAIL:-admin@indotek.co.id}"
export FIRST_ADMIN_PASSWORD="${FIRST_ADMIN_PASSWORD:-admin12345}"

info() { printf '\033[1;34m▸\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

start_postgres() {
  if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    if docker ps -a --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
      docker start "$PG_CONTAINER" >/dev/null
    else
      info "Membuat container Postgres dev…"
      docker run -d --name "$PG_CONTAINER" \
        -e POSTGRES_USER=pipelio -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=pipelio \
        -p "${PG_PORT}:5432" postgres:16-alpine >/dev/null
    fi
  fi
  for _ in $(seq 1 40); do
    docker exec "$PG_CONTAINER" pg_isready -U pipelio -d pipelio >/dev/null 2>&1 && return 0
    sleep 1
  done
  fail "Postgres dev tidak siap."
}

case "${1:-}" in
  setup)
    docker info >/dev/null 2>&1 || fail "Docker belum jalan. Nyalakan Docker Desktop dulu."
    info "Menyiapkan environment Python…"
    [ -d "$VENV" ] || python3 -m venv "$VENV"
    "$VENV/bin/python" -m pip install --quiet --upgrade pip
    "$VENV/bin/python" -m pip install --quiet -r "$API_DIR/requirements-dev.txt"

    info "Memasang dependency frontend…"
    (cd "$WEB_DIR" && npm install --no-audit --no-fund)

    start_postgres
    info "Menjalankan migrasi…"
    (cd "$API_DIR" && "$VENV/bin/python" -m alembic upgrade head)
    (cd "$API_DIR" && "$VENV/bin/python" -m app.seed)

    info "Selesai. Jalankan ./dev.sh — login: $FIRST_ADMIN_EMAIL / $FIRST_ADMIN_PASSWORD"
    exit 0
    ;;
  seed)
    start_postgres
    (cd "$API_DIR" && "$VENV/bin/python" -m app.seed --force)
    exit 0
    ;;
esac

[ -x "$VENV/bin/python" ] || fail "Belum di-setup. Jalankan: ./dev.sh setup"
[ -d "$WEB_DIR/node_modules" ] || fail "Belum di-setup. Jalankan: ./dev.sh setup"
docker info >/dev/null 2>&1 || fail "Docker belum jalan (dibutuhkan untuk Postgres dev)."

start_postgres
(cd "$API_DIR" && "$VENV/bin/python" -m alembic upgrade head >/dev/null)

# Bootstrap ikut dijalankan tiap start, bukan hanya saat setup: kalau container
# Postgres dev pernah dihapus, migrasi memang membuat ulang tabelnya tetapi
# tidak ada satu pun akun — aplikasi jalan namun tidak bisa dimasuki siapa pun.
# Skrip ini tidak melakukan apa-apa bila sudah ada user.
(cd "$API_DIR" && "$VENV/bin/python" -m app.bootstrap >/dev/null)

# bash 3.2 bawaan macOS tidak punya `wait -n`, jadi proses dipantau manual.
API_PID=""
WEB_PID=""
cleanup() {
  trap - INT TERM EXIT
  info "Menghentikan…"
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

info "Backend  → http://localhost:$API_PORT (docs: /docs)"
(cd "$API_DIR" && exec "$VENV/bin/python" -m uvicorn app.main:app --reload --port "$API_PORT") &
API_PID=$!

for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1 && break
  sleep 0.25
done

info "Frontend → http://localhost:5173"
(cd "$WEB_DIR" && exec npm run dev) &
WEB_PID=$!

printf '\n'
info "Login: $FIRST_ADMIN_EMAIL / $FIRST_ADMIN_PASSWORD"
info "Ctrl+C untuk menghentikan keduanya."
printf '\n'

while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 1
done

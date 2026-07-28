"""
Fixture tes.

Tes berjalan di atas SQLite in-memory, bukan Postgres, supaya bisa dijalankan
di mana saja tanpa container. Skema dibuat dari model yang sama, jadi perbedaan
dialek yang berarti tetap akan terlihat pada migrasi Alembic ke Postgres.
"""

from __future__ import annotations

import os

# Environment harus diatur SEBELUM app.config di-import — Settings dibaca sekali
# lalu di-cache oleh lru_cache.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "kunci-uji-yang-cukup-panjang-untuk-hs256")
os.environ.setdefault("APP_ENV", "test")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import Base, User
from app.security import hash_password

ADMIN = {"email": "admin@indotek.co.id", "password": "admin-password-123"}
SALES = {"email": "sales@indotek.co.id", "password": "sales-password-123"}


@pytest.fixture
def db_session():
    # StaticPool + koneksi tunggal: tanpa ini tiap koneksi SQLite in-memory
    # mendapat database kosong sendiri dan tabelnya "hilang".
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    session = TestingSession()
    session.add_all([
        User(
            email=ADMIN["email"],
            hashed_password=hash_password(ADMIN["password"]),
            full_name="Admin Uji",
            role="admin",
        ),
        User(
            email=SALES["email"],
            hashed_password=hash_password(SALES["password"]),
            full_name="Sales Uji",
            role="sales",
        ),
    ])
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _token(client, credentials) -> str:
    response = client.post("/api/auth/login", json=credentials)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def admin_headers(client):
    return {"Authorization": f"Bearer {_token(client, ADMIN)}"}


@pytest.fixture
def sales_headers(client):
    return {"Authorization": f"Bearer {_token(client, SALES)}"}

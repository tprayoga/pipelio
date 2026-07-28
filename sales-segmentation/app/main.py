"""
Backend Pipelio — API tunggal untuk aplikasi internal.

Menggantikan Base44 sepenuhnya: data, autentikasi, upload file, dan segmentasi
K-Means berada di satu service ini.

Jalankan lokal:  uvicorn app.main:app --reload --port 8000
Dokumentasi   :  http://localhost:8000/docs
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.db import engine
from app.routers import auth, clustering, entities, uploads

logger = logging.getLogger("pipelio")
settings = get_settings()

app = FastAPI(
    title="Pipelio API",
    description="Manajemen pipeline penjualan & segmentasi performa sales.",
    version="2.0.0",
    # Dokumentasi interaktif hanya dibuka di luar produksi.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
)

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(SQLAlchemyError)
def handle_db_error(request: Request, exc: SQLAlchemyError):
    # Pesan asli SQLAlchemy bisa memuat isi query dan nama kolom; catat di log,
    # jangan kirim ke browser.
    logger.exception("Database error pada %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Terjadi kesalahan pada database. Silakan coba lagi."},
    )


API_PREFIX = "/api"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(entities.router, prefix=API_PREFIX)
app.include_router(clustering.router, prefix=API_PREFIX)
app.include_router(uploads.router, prefix=API_PREFIX)


@app.get("/api/health")
def health():
    """Dipakai healthcheck Docker Compose dan pemantauan."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError:
        logger.exception("Healthcheck database gagal")
        database = "error"

    return {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
        "environment": settings.app_env,
        "version": app.version,
    }

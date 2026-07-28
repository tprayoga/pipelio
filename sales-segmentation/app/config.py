"""Konfigurasi aplikasi — seluruhnya lewat environment variable."""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Database ---
    database_url: str = Field(
        default="postgresql+psycopg://pipelio:pipelio@localhost:5432/pipelio",
        description="DSN SQLAlchemy. Docker Compose mengisinya otomatis.",
    )

    # --- Keamanan ---
    # WAJIB diganti di produksi. Aplikasi menolak jalan dengan nilai default
    # bila APP_ENV=production — token yang ditandatangani kunci publik bisa
    # dipalsukan siapa pun yang membaca repo ini.
    secret_key: str = Field(default="dev-secret-jangan-dipakai-di-produksi")
    access_token_expire_minutes: int = 60 * 12
    algorithm: str = "HS256"

    app_env: str = Field(default="development")

    # Origin yang boleh memanggil API, dipisah koma. Pada deployment satu domain
    # (nginx mem-proxy /api) nilainya boleh kosong karena tidak ada cross-origin.
    #
    # Tipenya sengaja str, bukan List[str]: pydantic-settings mem-parse field
    # bertipe list sebagai JSON langsung dari environment dan gagal keras pada
    # nilai biasa seperti "" atau "a,b" — sebelum validator apa pun sempat jalan.
    cors_origins: str = Field(default="http://localhost:5173")

    # Akun admin pertama, dibuat otomatis saat seed bila belum ada user.
    first_admin_email: str = "admin@indotek.co.id"
    first_admin_password: str = "ubah-password-ini"
    first_admin_name: str = "Administrator"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production and settings.secret_key == "dev-secret-jangan-dipakai-di-produksi":
        raise RuntimeError(
            "SECRET_KEY masih memakai nilai default sementara APP_ENV=production. "
            "Buat kunci acak, misalnya: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    return settings

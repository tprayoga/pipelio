"""Hashing password (bcrypt) dan token sesi (JWT)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from app.config import get_settings

settings = get_settings()

# bcrypt memotong input di 72 byte. Tanpa penjagaan ini, dua password panjang
# yang 72 byte pertamanya sama akan dianggap identik.
BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    encoded = password.encode("utf-8")[:BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8")[:BCRYPT_MAX_BYTES], hashed.encode("utf-8")
        )
    except (ValueError, TypeError):
        # Hash rusak / format tidak dikenal — perlakukan sebagai gagal login,
        # jangan sampai melempar 500 yang membocorkan keberadaan akun.
        return False


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expire, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> Optional[str]:
    """Kembalikan user id bila token sah, None bila tidak."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")

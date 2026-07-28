"""Dependency FastAPI: sesi database, user aktif, penjagaan role."""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import roles
from app.db import get_db
from app.models import Sales, User
from app.security import decode_access_token

# auto_error=False agar kita bisa mengembalikan pesan sendiri, bukan
# "Not authenticated" bawaan yang kurang informatif di frontend.
bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise CREDENTIALS_ERROR

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise CREDENTIALS_ERROR

    user = db.get(User, user_id)
    if user is None:
        raise CREDENTIALS_ERROR
    if not user.is_active:
        # Dibedakan dari 401 supaya frontend tidak melempar user ke halaman
        # login berulang kali padahal masalahnya akun dinonaktifkan.
        raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in roles.CAN_MANAGE_USERS:
        raise HTTPException(
            status_code=403, detail="Tindakan ini hanya untuk administrator."
        )
    return user


def require_master_data(user: User = Depends(get_current_user)) -> User:
    if user.role not in roles.CAN_MANAGE_MASTER_DATA:
        raise HTTPException(
            status_code=403,
            detail="Tindakan ini hanya untuk Head of Sales atau administrator.",
        )
    return user


def require_segmentation(user: User = Depends(get_current_user)) -> User:
    if user.role not in roles.CAN_RUN_SEGMENTATION:
        raise HTTPException(
            status_code=403,
            detail="Segmentasi performa hanya dijalankan Head of Sales atau administrator.",
        )
    return user


def scope_name(db: Session, user: User) -> Optional[str]:
    """
    Nama sales yang membatasi data milik `user`, atau None bila ia melihat
    seluruh tim.

    Sales Executive yang belum ditautkan ke satu record Sales tidak bisa
    dibatasi secara benar. Menolak lebih aman daripada diam-diam menampilkan
    data seluruh tim kepadanya.
    """
    if roles.sees_all_data(user.role):
        return None

    if not user.sales_id:
        raise HTTPException(
            status_code=403,
            detail=(
                "Akun Anda belum ditautkan ke data sales mana pun. "
                "Hubungi administrator untuk menautkannya."
            ),
        )

    sales = db.get(Sales, user.sales_id)
    if sales is None:
        raise HTTPException(
            status_code=403,
            detail="Data sales yang tertaut ke akun Anda sudah tidak ada. Hubungi administrator.",
        )
    return sales.name

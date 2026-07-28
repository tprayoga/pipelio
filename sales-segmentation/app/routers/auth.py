"""Autentikasi & pengelolaan user."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import roles, schemas
from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import User
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))

    # Pesan yang sama untuk email tidak dikenal maupun password salah, supaya
    # halaman login tidak bisa dipakai memeriksa email mana yang terdaftar.
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email atau password salah.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan.")

    return schemas.Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: schemas.PasswordChange,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Password saat ini salah.")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()


# --------------------------------------------------------------------------- #
# Pengelolaan user — admin saja.
# Tidak ada endpoint registrasi publik: ini aplikasi internal, akun dibuatkan
# administrator.
# --------------------------------------------------------------------------- #
@router.get("/users", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return list(db.scalars(select(User).order_by(User.created_date.desc())))


@router.post("/users", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    exists = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if exists:
        raise HTTPException(status_code=409, detail="Email tersebut sudah terdaftar.")

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        sales_id=payload.sales_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")

    data = payload.model_dump(exclude_unset=True)

    # Cegah admin mengunci dirinya sendiri keluar dari sistem.
    if user.id == admin.id:
        if data.get("is_active") is False:
            raise HTTPException(status_code=400, detail="Tidak bisa menonaktifkan akun sendiri.")
        if data.get("role") not in (None, roles.ADMIN):
            raise HTTPException(status_code=400, detail="Tidak bisa menurunkan role akun sendiri.")

    # Menurunkan admin terakhir akan membuat tidak ada lagi yang bisa mengelola
    # akun — sistem terkunci permanen tanpa akses ke database.
    demoting_admin = user.role == roles.ADMIN and data.get("role") not in (None, roles.ADMIN)
    deactivating_admin = user.role == roles.ADMIN and data.get("is_active") is False
    if demoting_admin or deactivating_admin:
        remaining = db.scalar(
            select(func.count()).select_from(User).where(
                User.role == roles.ADMIN, User.is_active.is_(True), User.id != user.id
            )
        )
        if not remaining:
            raise HTTPException(status_code=400, detail="Harus tersisa minimal satu admin aktif.")

    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    user_id: str,
    payload: schemas.PasswordReset,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri.")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")

    if user.role == roles.ADMIN:
        remaining = db.scalar(
            select(func.count()).select_from(User).where(
                User.role == roles.ADMIN, User.is_active.is_(True), User.id != user.id
            )
        )
        if not remaining:
            raise HTTPException(status_code=400, detail="Harus tersisa minimal satu admin aktif.")

    db.delete(user)
    db.commit()

"""
CRUD untuk Customer, Sales, dan Pipeline.

Menggantikan `base44.entities.*`. Bentuk endpoint sengaja dibuat sejajar dengan
pemanggilan lama di frontend (list dengan sort+limit, filter per periode)
sehingga halaman-halaman tidak perlu ditulis ulang.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.crud import apply_limit, apply_sort
from app.db import get_db
from app.deps import get_current_user, require_master_data, scope_name
from app.models import Customer, Pipeline, Sales, User

router = APIRouter(tags=["entities"])


# --------------------------------------------------------------------------- #
# Customer
# --------------------------------------------------------------------------- #
@router.get("/customers", response_model=List[schemas.CustomerOut])
def list_customers(
    sort: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = apply_limit(apply_sort(select(Customer), Customer, sort), limit)
    return list(db.scalars(stmt))


@router.post("/customers", response_model=schemas.CustomerOut, status_code=201)
def create_customer(
    payload: schemas.CustomerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = Customer(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/customers/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(
    customer_id: str,
    payload: schemas.CustomerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(Customer, customer_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Customer tidak ditemukan.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = db.get(Customer, customer_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Customer tidak ditemukan.")
    db.delete(obj)
    db.commit()


# --------------------------------------------------------------------------- #
# Sales
# --------------------------------------------------------------------------- #
@router.get("/sales", response_model=List[schemas.SalesOut])
def list_sales(
    sort: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = apply_limit(apply_sort(select(Sales), Sales, sort), limit)
    return list(db.scalars(stmt))


@router.post("/sales", response_model=schemas.SalesOut, status_code=201)
def create_sales(
    payload: schemas.SalesCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_master_data),
):
    obj = Sales(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/sales/{sales_id}", response_model=schemas.SalesOut)
def update_sales(
    sales_id: str,
    payload: schemas.SalesUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_master_data),
):
    obj = db.get(Sales, sales_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Sales tidak ditemukan.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/sales/{sales_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales(
    sales_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_master_data),
):
    obj = db.get(Sales, sales_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Sales tidak ditemukan.")
    db.delete(obj)
    db.commit()


# --------------------------------------------------------------------------- #
# Pipeline
# --------------------------------------------------------------------------- #
def _own_or_404(db: Session, pipeline_id: str, user: User) -> Pipeline:
    """
    Ambil satu pipeline, pastikan `user` berhak menyentuhnya.

    Pipeline milik orang lain dijawab 404, bukan 403: 403 memberi tahu bahwa
    record dengan id itu ADA, yang sudah merupakan kebocoran informasi.
    """
    obj = db.get(Pipeline, pipeline_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Pipeline tidak ditemukan.")

    limit_to = scope_name(db, user)
    if limit_to is not None and obj.sales_name != limit_to:
        raise HTTPException(status_code=404, detail="Pipeline tidak ditemukan.")
    return obj


@router.get("/pipelines", response_model=List[schemas.PipelineOut])
def list_pipelines(
    quarter: Optional[str] = Query(default=None),
    year: Optional[int] = Query(default=None),
    stage: Optional[str] = Query(default=None),
    sales_name: Optional[str] = Query(default=None),
    sort: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Filter dilakukan di sini, bukan di browser. Mengambil N record terbaru lalu
    memilah di frontend membuat periode paling lama tidak pernah ikut terambil.
    """
    stmt = select(Pipeline)

    # Pembatasan role diterapkan pada query, bukan setelahnya: Sales Executive
    # tidak pernah menerima baris milik rekannya, bahkan bila ia mengisi
    # parameter sales_name dengan nama orang lain.
    limit_to = scope_name(db, user)
    if limit_to is not None:
        stmt = stmt.where(Pipeline.sales_name == limit_to)
    elif sales_name:
        stmt = stmt.where(Pipeline.sales_name == sales_name)

    if quarter:
        stmt = stmt.where(Pipeline.quarter == quarter)
    if year is not None:
        stmt = stmt.where(Pipeline.year == year)
    if stage:
        stmt = stmt.where(Pipeline.stage == stage)

    return list(db.scalars(apply_limit(apply_sort(stmt, Pipeline, sort), limit)))


@router.post("/pipelines", response_model=schemas.PipelineOut, status_code=201)
def create_pipeline(
    payload: schemas.PipelineCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = payload.model_dump()

    # Sales Executive selalu tercatat sebagai pemilik pipeline yang ia buat,
    # apa pun isi sales_name yang dikirim.
    limit_to = scope_name(db, user)
    if limit_to is not None:
        data["sales_name"] = limit_to

    obj = Pipeline(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/pipelines/{pipeline_id}", response_model=schemas.PipelineOut)
def update_pipeline(
    pipeline_id: str,
    payload: schemas.PipelineUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    obj = _own_or_404(db, pipeline_id, user)

    data = payload.model_dump(exclude_unset=True)
    # Tanpa ini, seorang sales bisa memindahkan pipeline miliknya ke nama rekan
    # dan kehilangan akses ke datanya sendiri.
    if scope_name(db, user) is not None:
        data.pop("sales_name", None)

    for field, value in data.items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/pipelines/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pipeline(
    pipeline_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    db.delete(_own_or_404(db, pipeline_id, user))
    db.commit()

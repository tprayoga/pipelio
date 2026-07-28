"""
Tabel database.

Skema ini menggantikan entity Base44 (Base44/entities/*.jsonc). Nama kolom
sengaja dipertahankan sama dengan entity lama supaya frontend tidak perlu
mengubah nama field di seluruh halaman.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    # Dinamai created_date (bukan created_at) agar cocok dengan parameter sort
    # "-created_date" yang sudah dipakai di seluruh frontend.
    created_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    # admin = kelola user & seluruh data; sales = hanya baca + kelola pipeline
    role: Mapped[str] = mapped_column(String(20), default="sales")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Dihubungkan ke Sales agar seorang sales hanya melihat pipeline miliknya.
    sales_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("sales.id", ondelete="SET NULL"), nullable=True
    )


class Sales(Base, TimestampMixin):
    __tablename__ = "sales"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), index=True)
    email: Mapped[str] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="Active")
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    target: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company: Mapped[str] = mapped_column(String(255), index=True)
    pic: Mapped[str] = mapped_column(String(255))
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    industry: Mapped[str] = mapped_column(String(120), index=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Pipeline(Base, TimestampMixin):
    __tablename__ = "pipelines"
    # Segmentasi selalu memfilter per quarter+tahun, jadi indeks gabungan ini
    # yang menentukan kecepatannya saat data sudah banyak.
    __table_args__ = (
        Index("ix_pipelines_period", "year", "quarter"),
        Index("ix_pipelines_period_sales", "year", "quarter", "sales_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    customer: Mapped[str] = mapped_column(String(255), index=True)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    project_name: Mapped[str] = mapped_column(String(500))
    project_category: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    estimated_value: Mapped[float] = mapped_column(Float, default=0)
    estimated_closing: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    pic: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stage: Mapped[str] = mapped_column(String(20), default="Leads", index=True)
    sales_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    quarter: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="Active")


class ClusteringResult(Base, TimestampMixin):
    __tablename__ = "clustering_results"
    __table_args__ = (
        # Satu sales hanya boleh punya satu hasil per periode. Ini yang membuat
        # klik "Generate" berulang tidak menumpuk record ganda.
        UniqueConstraint("year", "quarter", "sales_name", name="uq_result_period_sales"),
        Index("ix_results_period", "year", "quarter"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    sales_name: Mapped[str] = mapped_column(String(255), index=True)
    quarter: Mapped[str] = mapped_column(String(4))
    year: Mapped[int] = mapped_column(Integer)

    lead: Mapped[float] = mapped_column(Float, default=0)
    prospecting: Mapped[float] = mapped_column(Float, default=0)
    negotiating: Mapped[float] = mapped_column(Float, default=0)
    won: Mapped[float] = mapped_column(Float, default=0)
    lost: Mapped[float] = mapped_column(Float, default=0)
    hold: Mapped[float] = mapped_column(Float, default=0)

    # Won / (Won + Lost + Hold) — bagian deal SELESAI yang berakhir menang.
    win_rate: Mapped[float] = mapped_column(Float, default=0)
    loss_rate: Mapped[float] = mapped_column(Float, default=0)

    cluster: Mapped[str] = mapped_column(String(30))
    # Relatif terhadap batch yang dianalisis — tidak sebanding antar-periode.
    score: Mapped[float] = mapped_column(Float, default=0)
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    silhouette_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

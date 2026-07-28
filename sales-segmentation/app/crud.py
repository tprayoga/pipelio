"""Utilitas query yang dipakai bersama seluruh router entity."""

from __future__ import annotations

from typing import Any, Optional, Type

from fastapi import HTTPException
from sqlalchemy import Select

# Batas atas jumlah record per request. Frontend memang meminta limit besar
# untuk menghitung total, tapi tanpa plafon satu request bisa menarik seluruh
# tabel dan menghabiskan memori proses.
MAX_LIMIT = 20_000
DEFAULT_LIMIT = 1_000


def apply_sort(stmt: Select, model: Type[Any], sort: Optional[str]) -> Select:
    """
    Menerima format yang sudah dipakai frontend: "-created_date" (turun),
    "created_date" (naik).
    """
    if not sort:
        return stmt.order_by(model.created_date.desc())

    descending = sort.startswith("-")
    field = sort[1:] if descending else sort

    column = getattr(model, field, None)
    if column is None:
        raise HTTPException(status_code=400, detail=f"Kolom sort '{field}' tidak dikenal.")

    return stmt.order_by(column.desc() if descending else column.asc())


def apply_limit(stmt: Select, limit: Optional[int]) -> Select:
    effective = DEFAULT_LIMIT if limit is None else min(limit, MAX_LIMIT)
    return stmt.limit(effective)

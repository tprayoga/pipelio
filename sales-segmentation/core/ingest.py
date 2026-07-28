"""
Ingest & penyiapan dataset.

Menjembatani data mentah (nama kolom bebas, per sales-quarter) ke skema yang
dipahami mesin clustering, lalu membentuk dataset sesuai mode analisis:
  - Akumulasi Tahunan : jumlahkan Q1..Q4 -> 1 baris per sales
  - Per Quarter       : ambil satu quarter -> 1 baris per sales
  - Sales-Quarter     : semua baris apa adanya (unit = sales x quarter)
"""

from __future__ import annotations

import pandas as pd

from . import config

# Peta nama kolom bebas -> nama baku (case-insensitive, spasi diabaikan)
COLUMN_ALIASES = {
    "sales executive": "name", "sales": "name", "nama": "name",
    "nama sales": "name", "name": "name",
    "quarter": "quarter", "q": "quarter", "kuartal": "quarter",
    "lead": "lead", "leads": "lead",
    "prospecting": "prospecting", "prospect": "prospecting",
    "negotiating": "negotiation", "negotiation": "negotiation",
    "negosiasi": "negotiation",
    "won": "won", "win": "won",
    "lost": "lost", "lose": "lost",
    "hold": "hold",
    "won_value": "won_value", "won value": "won_value",
    "nilai won": "won_value", "nilai proyeksi": "won_value",
    "sales_id": "sales_id", "id": "sales_id",
}


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Ubah nama kolom ke skema baku, tambahkan sales_id bila belum ada."""
    rename = {}
    for c in df.columns:
        key = str(c).strip().lower()
        if key in COLUMN_ALIASES:
            rename[c] = COLUMN_ALIASES[key]
    df = df.rename(columns=rename)

    if "sales_id" not in df.columns and "name" in df.columns:
        df["sales_id"] = pd.factorize(df["name"])[0] + 1

    return df


def has_quarter(df: pd.DataFrame) -> bool:
    return "quarter" in df.columns


def available_quarters(df: pd.DataFrame) -> list:
    if not has_quarter(df):
        return []
    return sorted(df["quarter"].dropna().unique().tolist())


def _sum_features(df: pd.DataFrame, group_cols: list) -> pd.DataFrame:
    feats = [f for f in config.BASE_FEATURES + config.OPTIONAL_FEATURES
             if f in df.columns]
    return df.groupby(group_cols, as_index=False)[feats].sum()


def aggregate_annual(df: pd.DataFrame) -> pd.DataFrame:
    """Jumlahkan seluruh quarter -> 1 baris per sales."""
    if not has_quarter(df):
        return df.reset_index(drop=True)
    return _sum_features(df, ["sales_id", "name"])


def filter_quarter(df: pd.DataFrame, quarter: str) -> pd.DataFrame:
    """Ambil satu quarter saja."""
    return df[df["quarter"] == quarter].reset_index(drop=True)


def as_sales_quarter(df: pd.DataFrame) -> pd.DataFrame:
    """
    Semua baris apa adanya. Nama digabung dengan quarter agar unik di visualisasi
    (satu sales muncul di beberapa baris).
    """
    d = df.copy()
    if has_quarter(d):
        d["name"] = d["name"].astype(str) + " (" + d["quarter"].astype(str) + ")"
    return d.reset_index(drop=True)

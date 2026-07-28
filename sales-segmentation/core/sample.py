"""
Dataset contoh untuk pembuktian metode.

Sumbernya SATU file: `data/sales_pipeline_2025.csv` (data pipeline 2025
PT Indotek Buana Karya). Sebelumnya 40 baris yang sama juga di-hardcode di modul
ini, sehingga ada dua sumber kebenaran yang bisa diam-diam berbeda.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "sales_pipeline_2025.csv"


def load_pipeline_2025() -> pd.DataFrame:
    """Baca data pipeline 2025 apa adanya (40 baris sales-quarter)."""
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset contoh tidak ditemukan di {DATA_PATH}. "
            "File ini bagian dari repo — pastikan folder data/ ikut tersalin."
        )
    return pd.read_csv(DATA_PATH)


def make_sales_quarter_40() -> pd.DataFrame:
    """40 baris (unit = sales x quarter) — dataset lebih gemuk untuk uji metode."""
    return load_pipeline_2025()


def make_annual_10() -> pd.DataFrame:
    """10 sales (akumulasi Q1..Q4, tanpa kolom Quarter)."""
    df = load_pipeline_2025().drop(columns=["Quarter"])
    return df.groupby("Sales Executive", as_index=False).sum()

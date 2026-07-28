"""
Interpretasi & rekomendasi manajerial per cluster.
Teks dasar mengikuti dokumen rancangan, ditambah ringkasan angka aktual.
"""

from __future__ import annotations

import pandas as pd

from . import config

BASE_INSIGHTS = {
    "High": {
        "karakteristik": ["Nilai Won tinggi", "Nilai Hold rendah"],
        "rekomendasi": [
            "Pertahankan strategi penjualan yang sudah berjalan.",
            "Beri peluang menangani proyek bernilai besar.",
            "Jadikan sebagai mentor bagi anggota tim lainnya.",
        ],
    },
    "Medium": {
        "karakteristik": ["Pipeline relatif stabil", "Closing cukup baik"],
        "rekomendasi": [
            "Berikan pendampingan saat proses negosiasi.",
            "Lakukan monitoring performa secara berkala.",
        ],
    },
    "Low": {
        "karakteristik": ["Nilai Won rendah", "Nilai Hold tinggi"],
        "rekomendasi": [
            "Lakukan coaching secara intensif.",
            "Evaluasi kembali aktivitas pipeline.",
            "Prioritaskan pendampingan dan tindak lanjut.",
        ],
    },
}


def cluster_summary(result_df: pd.DataFrame) -> pd.DataFrame:
    feats = config.active_features(result_df.columns)
    agg = result_df.groupby("label")[feats].mean().round(2)
    agg["jumlah_sales"] = result_df.groupby("label").size()
    order = [l for l in config.LABEL_ORDER if l in agg.index]
    return agg.loc[order]


def build_insights(result_df: pd.DataFrame) -> list:
    summary = cluster_summary(result_df)
    has_value = "won_value" in result_df.columns
    out = []
    for label in config.LABEL_ORDER:
        if label not in summary.index:
            continue
        row = summary.loc[label]
        members = result_df.loc[result_df["label"] == label, "name"].tolist()
        base = BASE_INSIGHTS[label]
        item = {
            "label": label,
            "jumlah_sales": int(row["jumlah_sales"]),
            "anggota": members,
            "rata_won": float(row["won"]),
            "rata_lost": float(row["lost"]),
            "rata_hold": float(row["hold"]),
            "rata_won_value": float(row["won_value"]) if has_value else None,
            "karakteristik": base["karakteristik"],
            "rekomendasi": base["rekomendasi"],
        }
        out.append(item)
    return out

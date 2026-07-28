"""
Segmentasi performa sales.

Perhitungannya tetap milik `core/` — modul ini hanya mengambil data pipeline
dari database, mengagregasinya per sales, memanggil core, lalu menyimpan hasil.
Tidak ada logika K-Means di sini, dan tidak boleh ada di frontend.
"""

from __future__ import annotations

from typing import Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.crud import apply_limit, apply_sort
from app.db import get_db
from app.deps import get_current_user, require_segmentation, scope_name
from app.models import ClusteringResult, Pipeline, User
from core import clustering, config, insights

router = APIRouter(tags=["clustering"])

# Nama stage di database -> nama fitur yang dipahami core/config.py
STAGE_TO_FEATURE = {
    "Leads": "lead",
    "Prospecting": "prospecting",
    "Negotiating": "negotiation",
    "Won": "won",
    "Lost": "lost",
    "Hold": "hold",
}
LABEL_TO_CLUSTER_NAME = {
    "High": "High Performance",
    "Medium": "Medium Performance",
    "Low": "Low Performance",
}


def _aggregate(rows: List[Pipeline]) -> pd.DataFrame:
    """
    Satu baris per sales, berisi jumlah deal di tiap stage.

    Tiap deal dihitung pada stage-nya saat ini, sehingga keenam angka menjumlah
    ke total deal milik sales tersebut.
    """
    per_sales: Dict[str, Dict[str, float]] = {}
    for row in rows:
        name = (row.sales_name or "").strip() or "Belum ditugaskan"
        bucket = per_sales.setdefault(
            name, {"name": name, **{feature: 0.0 for feature in config.BASE_FEATURES}}
        )
        feature = STAGE_TO_FEATURE.get(row.stage)
        if feature:
            bucket[feature] += 1

    return pd.DataFrame(list(per_sales.values()))


def _close_rates(row) -> tuple:
    concluded = row["won"] + row["lost"] + row["hold"]
    if concluded <= 0:
        return 0.0, 0.0
    return row["won"] / concluded, row["lost"] / concluded


def _load_period(db: Session, quarter: str, year: int) -> pd.DataFrame:
    rows = list(
        db.scalars(select(Pipeline).where(Pipeline.quarter == quarter, Pipeline.year == year))
    )
    if not rows:
        raise HTTPException(
            status_code=404, detail=f"Tidak ada data pipeline untuk {quarter} {year}."
        )

    data = _aggregate(rows)
    if len(data) < 3:
        raise HTTPException(
            status_code=400,
            detail=f"Butuh minimal 3 sales untuk clustering, hanya ada {len(data)}.",
        )
    return data


@router.post("/segmentation/run", response_model=schemas.SegmentResponse)
def run_segmentation(
    payload: schemas.SegmentRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_segmentation),
):
    data = _load_period(db, payload.quarter, payload.year)

    if len(data) < payload.k:
        raise HTTPException(
            status_code=400,
            detail=f"Butuh minimal {payload.k} sales untuk K={payload.k}, hanya ada {len(data)}.",
        )

    result, silhouette = clustering.run_clustering(data, k=payload.k)
    built = insights.build_insights(result)
    recommendation_by_label = {i["label"]: "; ".join(i["rekomendasi"]) for i in built}

    results: List[schemas.SalesResult] = []
    for _, row in result.iterrows():
        win_rate, loss_rate = _close_rates(row)
        cluster_name = LABEL_TO_CLUSTER_NAME.get(row["label"], row["label"])
        results.append(
            schemas.SalesResult(
                name=row["name"],
                lead=row["lead"], prospecting=row["prospecting"], negotiation=row["negotiation"],
                won=row["won"], lost=row["lost"], hold=row["hold"],
                win_rate=win_rate, loss_rate=loss_rate,
                cluster=int(row["cluster"]),
                score=float(row["score"]),
                label=row["label"],
                cluster_name=cluster_name,
                recommendation=recommendation_by_label.get(row["label"], ""),
            )
        )

    # Hasil hanya disimpan untuk K=3. Tabel ClusteringResult beserta seluruh
    # laporan dan riwayat di frontend dibangun atas skema tiga tingkat
    # High/Medium/Low; menyimpan label "Tier n" akan merusaknya. K lain tetap
    # boleh dijalankan sebagai eksplorasi, hasilnya tampil tanpa disimpan.
    saved = False
    if payload.save and payload.k == config.N_CLUSTERS:
        _persist(db, payload.quarter, payload.year, results, silhouette)
        saved = True

    return schemas.SegmentResponse(
        results=results,
        silhouette=silhouette,
        n_rows=len(result),
        k=payload.k,
        features_used=config.active_features(result.columns),
        insights=built,
        saved=saved,
    )


def _persist(
    db: Session,
    quarter: str,
    year: int,
    results: List[schemas.SalesResult],
    silhouette: Optional[float],
) -> None:
    """
    Tulis hasil periode ini dalam SATU transaksi.

    Hapus-lalu-tulis di dalam transaksi yang sama berarti kegagalan di tengah
    jalan mengembalikan seluruhnya — riwayat periode tidak mungkin hilang
    setengah jalan seperti pada implementasi sebelumnya yang menghapus dulu,
    menulis kemudian, tanpa transaksi.
    """
    try:
        existing = db.scalars(
            select(ClusteringResult).where(
                ClusteringResult.quarter == quarter, ClusteringResult.year == year
            )
        ).all()
        for row in existing:
            db.delete(row)
        db.flush()

        for item in results:
            db.add(
                ClusteringResult(
                    sales_name=item.name,
                    quarter=quarter,
                    year=year,
                    lead=item.lead, prospecting=item.prospecting, negotiating=item.negotiation,
                    won=item.won, lost=item.lost, hold=item.hold,
                    win_rate=item.win_rate, loss_rate=item.loss_rate,
                    cluster=item.cluster_name,
                    score=item.score,
                    recommendation=item.recommendation,
                    silhouette_score=silhouette,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        raise


@router.post("/segmentation/sweep-k")
def sweep_k(
    payload: schemas.SweepRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_segmentation),
):
    """Silhouette & inertia untuk beberapa K — bukti pemilihan K=3."""
    data = _load_period(db, payload.quarter, payload.year)
    sweep = clustering.sweep_k(data, k_values=tuple(payload.k_values))

    rows = []
    for record in sweep.to_dict(orient="records"):
        rows.append({k: (None if pd.isna(v) else v) for k, v in record.items()})

    valid = [r for r in rows if r.get("silhouette") is not None]
    return {
        "sweep": rows,
        "best_k": max(valid, key=lambda r: r["silhouette"])["k"] if valid else None,
        "n_rows": len(data),
    }


@router.get("/segmentation/results", response_model=List[schemas.ClusteringResultOut])
def list_results(
    quarter: Optional[str] = Query(default=None),
    year: Optional[int] = Query(default=None),
    sort: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Riwayat hasil segmentasi.

    Sales Executive hanya menerima barisnya sendiri — ia boleh tahu kelompoknya
    dan rekomendasi untuk dirinya, tetapi tidak melihat penilaian rekan kerja.
    """
    stmt = select(ClusteringResult)

    limit_to = scope_name(db, user)
    if limit_to is not None:
        stmt = stmt.where(ClusteringResult.sales_name == limit_to)

    if quarter:
        stmt = stmt.where(ClusteringResult.quarter == quarter)
    if year is not None:
        stmt = stmt.where(ClusteringResult.year == year)
    return list(db.scalars(apply_limit(apply_sort(stmt, ClusteringResult, sort), limit)))


@router.get("/segmentation/method")
def method_info():
    """Parameter model yang sedang aktif — ditampilkan di halaman segmentasi."""
    return {
        "algorithm": "K-Means",
        "normalization": "StandardScaler",
        "default_k": config.N_CLUSTERS,
        "random_state": config.RANDOM_STATE,
        "n_init": config.KMEANS_N_INIT,
        "features": config.BASE_FEATURES,
        "label_rule": "skor komposit: Won positif; Lost & Hold negatif",
    }

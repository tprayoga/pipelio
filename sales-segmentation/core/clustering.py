"""
Mesin clustering — INTI penelitian.

Modul ini tidak tahu-menahu soal Streamlit maupun web. Ia hanya menerima
DataFrame dan mengembalikan DataFrame + metrik. Dengan begitu:
  - Streamlit memanggilnya sekarang
  - FastAPI (microservice) nanti tinggal membungkus fungsi yang sama
Fitur dipilih otomatis dari kolom yang tersedia (won_value opsional).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from . import config


def validate_dataframe(df: pd.DataFrame) -> None:
    missing = [c for c in config.REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            "Kolom berikut tidak ditemukan pada dataset: " + ", ".join(missing)
        )


def _composite_score(df: pd.DataFrame) -> np.ndarray:
    """Skor komposit per baris (standardisasi lalu dibobot). Hanya untuk mengurutkan cluster."""
    weights = config.active_score_weights(df.columns)
    cols = list(weights.keys())
    z = StandardScaler().fit_transform(df[cols])
    w = np.array([weights[c] for c in cols])
    return z @ w


def _map_clusters_to_labels(df: pd.DataFrame) -> dict:
    """
    Urutkan cluster berdasarkan rata-rata skor, lalu beri label.

    K=3 memakai skema High/Medium/Low sesuai dokumen rancangan. Untuk K lain
    (fitur eksplorasi) label dibuat berdasarkan peringkat — sebelumnya kode ini
    mengindeks LABEL_ORDER yang hanya berisi 3 nama, sehingga K=4 ke atas
    langsung melempar IndexError.
    """
    mean_score = df.groupby("cluster")["score"].mean().sort_values(ascending=False)
    ordered = mean_score.index.tolist()

    if len(ordered) == len(config.LABEL_ORDER):
        return {cl: config.LABEL_ORDER[i] for i, cl in enumerate(ordered)}
    return {cl: f"Tier {i + 1}" for i, cl in enumerate(ordered)}


def labels_ok(labels, n: int) -> bool:
    return 2 <= len(set(labels)) <= n - 1


def run_clustering(df: pd.DataFrame, k: int = config.N_CLUSTERS):
    """
    Pipeline clustering lengkap.
    Return: (result_df + kolom cluster/score/label, silhouette | None)
    """
    validate_dataframe(df)
    result = df.copy().reset_index(drop=True)
    feats = config.active_features(result.columns)

    # 1) Normalisasi (StandardScaler) — wajib untuk K-Means berbasis jarak
    X = StandardScaler().fit_transform(result[feats])

    # 2) K-Means deterministik
    km = KMeans(
        n_clusters=k,
        init=config.KMEANS_INIT,
        n_init=config.KMEANS_N_INIT,
        random_state=config.RANDOM_STATE,
    )
    result["cluster"] = km.fit_predict(X)

    # 3) Silhouette Score
    silhouette = (
        float(silhouette_score(X, result["cluster"]))
        if labels_ok(result["cluster"], len(result))
        else None
    )

    # 4) Skor komposit -> urutkan cluster -> label
    result["score"] = _composite_score(result)
    result["label"] = result["cluster"].map(_map_clusters_to_labels(result))
    return result, silhouette


def sweep_k(df: pd.DataFrame, k_values=(2, 3, 4, 5)) -> pd.DataFrame:
    """Silhouette Score untuk beberapa K — pembuktian pemilihan K=3."""
    validate_dataframe(df)
    feats = config.active_features(df.columns)
    X = StandardScaler().fit_transform(df[feats])
    rows = []
    for k in k_values:
        if k >= len(df):
            continue
        km = KMeans(
            n_clusters=k,
            init=config.KMEANS_INIT,
            n_init=config.KMEANS_N_INIT,
            random_state=config.RANDOM_STATE,
        )
        labels = km.fit_predict(X)
        sil = silhouette_score(X, labels) if labels_ok(labels, len(df)) else None
        rows.append({"k": k, "silhouette": sil, "inertia": float(km.inertia_)})
    return pd.DataFrame(rows)


def pca_2d(df: pd.DataFrame) -> np.ndarray:
    """Proyeksi fitur ke 2D (PCA) untuk visualisasi scatter. Tidak memengaruhi hasil."""
    from sklearn.decomposition import PCA

    feats = config.active_features(df.columns)
    X = StandardScaler().fit_transform(df[feats])
    return PCA(n_components=2, random_state=config.RANDOM_STATE).fit_transform(X)

"""
Konfigurasi terpusat untuk mesin clustering.
Semua "keputusan pemodelan" (fitur, bobot, parameter) dikumpulkan di sini
supaya mudah dijelaskan saat sidang dan mudah diubah tanpa menyentuh logika.
"""

# ---------------------------------------------------------------------------
# Fitur clustering.
# BASE_FEATURES = 6 aktivitas pipeline sesuai dokumen rancangan.
# OPTIONAL_FEATURES = fitur tambahan yang dipakai HANYA jika tersedia di data
#   (mis. won_value / Nilai Proyeksi Won). Data riil belum tentu punya kolom ini.
# ---------------------------------------------------------------------------
BASE_FEATURES = [
    "lead",
    "prospecting",
    "negotiation",
    "won",
    "lost",
    "hold",
]
OPTIONAL_FEATURES = ["won_value"]

ID_COLUMNS = ["sales_id", "name"]

# Kolom minimum yang wajib ada setelah normalisasi
REQUIRED_COLUMNS = ["name"] + BASE_FEATURES


def active_features(columns) -> list:
    """Fitur yang benar-benar dipakai = base + optional yang tersedia di data."""
    cols = set(columns)
    feats = [f for f in BASE_FEATURES if f in cols]
    feats += [f for f in OPTIONAL_FEATURES if f in cols]
    return feats


# ---------------------------------------------------------------------------
# Parameter K-Means. n_init tinggi + random_state tetap = deterministik & stabil,
# penting karena data kecil (10 sales) sensitif terhadap inisialisasi.
# ---------------------------------------------------------------------------
N_CLUSTERS = 3
KMEANS_INIT = "k-means++"
KMEANS_N_INIT = 25
RANDOM_STATE = 42

# ---------------------------------------------------------------------------
# Skor komposit untuk MENGURUTKAN cluster -> High / Medium / Low.
# won, won_value = makin tinggi makin baik (+); lost, hold = makin buruk (-).
# Bobot won_value hanya dipakai jika kolomnya ada.
# ---------------------------------------------------------------------------
BASE_SCORE_WEIGHTS = {"won": 1.0, "lost": -1.0, "hold": -1.0}
OPTIONAL_SCORE_WEIGHTS = {"won_value": 1.0}


def active_score_weights(columns) -> dict:
    cols = set(columns)
    merged = {**BASE_SCORE_WEIGHTS, **OPTIONAL_SCORE_WEIGHTS}
    return {k: v for k, v in merged.items() if k in cols}


LABEL_ORDER = ["High", "Medium", "Low"]

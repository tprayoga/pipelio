# Pipelio Backend — API & Mesin Segmentasi

Backend aplikasi internal PT Indotek Buana Karya: data, autentikasi, upload file,
dan segmentasi performa sales dengan K-Means.

Mesin clustering ada di `core/` dan **hanya ada satu implementasi di seluruh
proyek**. API (`app/`) dan app Streamlit memanggil fungsi yang sama, sehingga
angka di aplikasi identik dengan angka yang dikutip di naskah skripsi.

---

## Struktur Proyek

```
sales-segmentation/
├── core/                 # MESIN CLUSTERING — dipakai API & Streamlit
│   ├── config.py         # fitur, bobot skor, parameter K-Means
│   ├── clustering.py     # scaling → KMeans → silhouette → label High/Medium/Low
│   ├── insights.py       # ringkasan & rekomendasi per cluster
│   ├── ingest.py         # normalisasi nama kolom + mode agregasi
│   └── sample.py         # memuat dataset contoh dari data/
├── app/                  # BACKEND PRODUKSI (FastAPI)
│   ├── main.py           # aplikasi + routing
│   ├── config.py         # setting dari environment
│   ├── models.py         # tabel database (SQLAlchemy)
│   ├── schemas.py        # validasi request/response
│   ├── security.py       # hash password (bcrypt) & token (JWT)
│   ├── roles.py          # peran & aturan akses
│   ├── deps.py           # sesi DB, user aktif, penjagaan role
│   ├── seed.py           # isi data contoh
│   ├── bootstrap.py      # buat admin pertama
│   └── routers/          # auth, entities, clustering, uploads
├── alembic/              # migrasi database
├── tests/                # 60 tes
├── streamlit_app.py      # demo sidang (opsional, tidak ikut ke container)
├── data/
│   ├── sales_pipeline_2025.csv
│   └── hasil_clustering_2025_tahunan.xlsx
├── Dockerfile
└── requirements*.txt
```

## Menjalankan

Produksi lewat Docker Compose — lihat [README utama](../README.md).

Pengembangan lokal: `./dev.sh` dari folder induk, atau manual:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

export DATABASE_URL="postgresql+psycopg://pipelio:devpass@localhost:55432/pipelio"
export SECRET_KEY="kunci-pengembangan"
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Dokumentasi endpoint: `http://localhost:8000/docs` (tertutup saat `APP_ENV=production`).

**Streamlit** (demo sidang) tidak butuh database — ia membaca file langsung:

```bash
pip install -r requirements-streamlit.txt
streamlit run streamlit_app.py
```

## Tes

```bash
python -m pytest tests/ -v
```

Berjalan di atas SQLite in-memory, jadi tidak perlu container.

## API

| Endpoint | Fungsi |
|---|---|
| `POST /api/auth/login` | Login, mengembalikan JWT |
| `GET /api/auth/me` | Profil user aktif |
| `POST /api/auth/change-password` | Ganti password sendiri |
| `GET/POST/PATCH/DELETE /api/auth/users` | Kelola user (admin) |
| `GET/POST/PATCH/DELETE /api/customers` | Customer |
| `GET/POST/PATCH/DELETE /api/sales` | Master sales (ubah = head_sales/admin) |
| `GET/POST/PATCH/DELETE /api/pipelines` | Pipeline, filter `quarter`/`year`/`stage` |
| `POST /api/segmentation/run` | Jalankan K-Means + simpan hasil (head_sales/admin) |
| `POST /api/segmentation/sweep-k` | Silhouette untuk beberapa K (head_sales/admin) |
| `GET /api/segmentation/results` | Riwayat hasil segmentasi |
| `GET /api/uploads/template` | Unduh template Excel (head_sales/admin) |
| `POST /api/uploads/preview` | Baca Excel/CSV (head_sales/admin) |
| `POST /api/uploads/import` | Simpan baris hasil pratinjau (head_sales/admin) |
| `GET /api/health` | Status service & database |

Semua endpoint kecuali `/api/health` dan `/api/auth/login` membutuhkan token.

**Pembatasan per peran.** `/api/pipelines` dan `/api/segmentation/results`
mempersempit hasilnya di level query untuk peran `sales`: ia hanya menerima
baris atas namanya sendiri, bahkan bila memanggil dengan parameter `sales_name`
milik orang lain. Aturannya terkumpul di `app/roles.py`; lihat tabel peran di
[README utama](../README.md). Pipeline milik orang lain dijawab **404**, bukan
403 — 403 sudah membocorkan bahwa record dengan id itu ada.

Catatan: `EmailStr` menolak domain special-use seperti `.local`. Bila kantor
memakai domain internal semacam itu untuk akun, validasi di `app/schemas.py`
yang perlu dilonggarkan.

## Migrasi database

```bash
alembic revision --autogenerate -m "deskripsi perubahan"
alembic upgrade head
```

Container `api` menjalankan `alembic upgrade head` otomatis saat start, jadi
deploy versi baru tidak perlu langkah manual.

---

## Alur Sistem

Preview Dataset → Proses Clustering (K-Means, K=3, StandardScaler) →
Evaluasi Silhouette Score → Hasil Segmentasi (High/Medium/Low) →
Visualisasi (pie, bar, sebaran PCA) → Insight & Rekomendasi → Simpan hasil.

### Keputusan metode yang penting

- **Normalisasi**: StandardScaler (z-score) — wajib karena K-Means berbasis jarak.
- **Determinisme**: `n_init=25` + `random_state=42` → hasil sama setiap run.
  Penting karena data kecil sensitif terhadap inisialisasi. Dijaga oleh
  `tests/test_segmentation.py::test_segmentasi_deterministik`.
- **Pemetaan cluster → label**: K-Means hanya menghasilkan C0/C1/C2 tanpa urutan.
  Sistem menghitung **skor komposit** (Won & Won Value positif; Lost & Hold negatif),
  lalu mengurutkan cluster berdasarkan rata-rata skor → High/Medium/Low.
- **Pemilihan K**: `sweep_k` menampilkan silhouette K=2..5 sebagai bukti bahwa
  K=3 masuk akal. Pada data Indotek, K=3 memang tertinggi.

### Hasil pada data riil (akumulasi tahunan, N=10)

| K | Silhouette | Inertia |
|---|---|---|
| 2 | 0.5176 | 20.46 |
| **3** | **0.6516** | **4.80** |
| 4 | 0.5057 | 3.30 |
| 5 | 0.3797 | 2.04 |

Angka-angka ini diverifikasi otomatis oleh `tests/test_segmentation.py`, jadi ketahuan
langsung bila ada perubahan kode atau versi library yang menggesernya.

---

## Keterbatasan yang perlu dinyatakan di naskah

**N kecil.** Data riil Indotek hanya 10 sales — terlalu kecil untuk pembagian 3
cluster yang kokoh. Pembuktian metode bisa memakai unit sales-quarter (40 baris,
mode `sales_quarter`); nyatakan terbuka sebagai dataset uji. Cantumkan N kecil
sebagai keterbatasan penelitian.

**Fitur berbasis volume.** Keenam fitur adalah hitungan mentah, sehingga jarak
Euclidean ikut dipengaruhi besaran aktivitas (`lead` punya rentang terbesar),
bukan hanya efisiensi closing. Pada data Indotek 2025 aktivitas dan hasil
kebetulan berkorelasi sehingga tidak menimbulkan anomali — tetapi itu properti
dataset, bukan jaminan metode. Siapkan pembelaan untuk pertanyaan ini, atau
tambahkan fitur rasio di `core/config.py` bila ingin mengukur efisiensi.

**Skor komposit bersifat relatif.** `_composite_score` menstandarkan ulang setiap
kali dipanggil, jadi skor hanya bermakna **di dalam satu batch analisis**. Skor
mode Tahunan tidak sebanding dengan skor mode Q1, dan skor antar-quarter tidak
boleh dibandingkan langsung sebagai "tren".

---

## Integrasi dengan frontend

`../Project Pipeline` (React) memanggil `POST /api/segmentation/run` lewat
`src/api/entities.js`. Pada produksi nginx mem-proxy `/api` ke service ini, jadi
keduanya satu origin.

Frontend **tidak** mengimplementasikan K-Means sendiri — versi JavaScript
sebelumnya dihapus karena memakai `Math.random()` tanpa seed (hasil berubah tiap
klik) dan memakai fitur berbeda, sehingga angkanya tidak akan pernah cocok
dengan naskah.

Catatan: K selain 3 boleh dijalankan untuk eksplorasi, tetapi hasilnya **tidak
disimpan** — tabel hasil dan seluruh laporan dibangun atas skema tiga tingkat
High/Medium/Low.

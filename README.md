# Pipelio — Sales Pipeline & Segmentasi Performa Sales

Aplikasi internal PT Indotek Buana Karya. Mengelola pipeline penjualan dan
mengelompokkan performa sales dengan K-Means clustering.

**Berdiri sendiri sepenuhnya** — tidak ada ketergantungan pada Base44 atau
layanan pihak ketiga lain. Data, autentikasi, upload file, dan perhitungan
clustering semuanya berjalan di server sendiri.

| Folder | Isi |
|---|---|
| [`sales-segmentation/`](sales-segmentation/) | Backend FastAPI + mesin K-Means (`core/`) + app Streamlit |
| [`Project Pipeline/`](Project%20Pipeline/) | Frontend React |

---

## Menjalankan di produksi (Docker Compose)

```bash
cp .env.example .env
# Isi .env — minimal POSTGRES_PASSWORD, SECRET_KEY, FIRST_ADMIN_PASSWORD.
# Buat SECRET_KEY acak:
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

docker compose up -d --build
```

Aplikasi tersedia di `http://<alamat-server>:8080` (ubah lewat `WEB_PORT`).

Saat pertama kali jalan, container `api` otomatis menjalankan migrasi database
dan membuat akun admin dari `FIRST_ADMIN_*`. **Segera ganti password admin**
lewat menu "Ubah Password" setelah login pertama.

Mengisi data contoh (opsional, untuk demo/pelatihan — jangan di database berisi
data asli):

```bash
docker compose exec api python -m app.seed
```

### Perintah operasional

```bash
docker compose logs -f api          # log backend
docker compose ps                   # status container
docker compose down                 # berhenti (data tetap aman di volume)
docker compose up -d --build        # deploy versi baru
```

### Backup database

```bash
docker compose exec -T db pg_dump -U pipelio pipelio > backup-$(date +%F).sql

# Pulihkan:
cat backup-2026-07-28.sql | docker compose exec -T db psql -U pipelio -d pipelio
```

Jadwalkan lewat cron. Volume `pipelio_db` bertahan melintasi `docker compose down`,
tetapi ikut terhapus bila dijalankan dengan `-v` — jadi backup tetap perlu.

---

## Menjalankan di lokal (pengembangan)

Yang perlu terpasang: **Docker Desktop** (hanya dipakai untuk Postgres),
**Python 3**, dan **Node.js**.

### Sekali saja

```bash
cd /Users/user/Documents/feri
./dev.sh setup
```

Menyiapkan virtualenv Python, `npm install`, container Postgres dev,
menjalankan migrasi, lalu mengisi data contoh.

### Setiap kali bekerja

```bash
./dev.sh
```

| Alamat | Isi |
|---|---|
| **http://localhost:5173** | Aplikasi |
| http://localhost:8000/docs | Dokumentasi API, bisa dicoba langsung |

Login awal: **`admin@indotek.co.id`** / **`admin12345`**

`Ctrl+C` menghentikan backend dan frontend sekaligus. Keduanya *hot reload* —
ubah kode Python atau React, halaman menyesuaikan sendiri.

Tidak perlu membuat `.env.local`: seluruh nilai default sudah benar untuk
pengembangan. Vite mem-proxy `/api` ke `http://localhost:8000`, jadi frontend
dan backend selalu satu origin seperti di produksi.

### Perintah lain

```bash
./dev.sh seed      # hapus data lama, isi ulang dengan data contoh
```

```bash
cd sales-segmentation && .venv/bin/python -m pytest tests/ -v   # 60 tes
cd "Project Pipeline" && npm run check                          # impor + lint + typecheck
```

### Mencoba pembatasan peran

Data contoh hanya membuat satu akun admin. Untuk melihat perbedaan antar-peran,
buat akunnya lewat menu **Manajemen User** (login sebagai admin):

- **Head of Sales** — cukup isi nama, email, dan password.
- **Sales Executive** — wajib mengisi **"Tautkan ke data sales"**. Tautan itulah
  yang menentukan pipeline siapa yang ia lihat; tanpa itu akunnya ditolak saat
  membuka data.

Logout, lalu login sebagai akun baru — menu dan angka di dashboard akan berbeda
sesuai tabel [Peran pengguna](#peran-pengguna) di bawah.

### Bedanya dengan produksi

| | Lokal (`./dev.sh`) | Produksi (`docker compose`) |
|---|---|---|
| Frontend | Vite dev server, hot reload | nginx melayani hasil build |
| Backend | uvicorn `--reload` | dalam container |
| Postgres | container `pipelio-pg-dev`, port 55432 | container `db`, tidak terekspos |
| `/docs` | terbuka | tertutup |
| `APP_ENV` | `development` | `production` |

Port Postgres dev sengaja dibuat 55432 supaya tidak bentrok bila stack produksi
kebetulan ikut berjalan di mesin yang sama.

### Kalau ada masalah

| Gejala | Sebab & solusi |
|---|---|
| `Docker belum jalan` | Nyalakan Docker Desktop, tunggu sampai siap, ulangi. |
| `Belum di-setup` | Jalankan `./dev.sh setup` lebih dulu. |
| Halaman gagal memuat data | Backend belum siap; lihat log di terminal yang menjalankan `./dev.sh`. |
| Aplikasi jalan tapi datanya kosong | Database dev terhapus. Akun admin dibuat ulang otomatis; isi datanya dengan `./dev.sh seed`. |
| Port 8000 dipakai proses lain | `API_PORT=8010 ./dev.sh` |

Mulai benar-benar dari nol — membuang database dev beserta seluruh isinya:

```bash
docker rm -f pipelio-pg-dev
./dev.sh setup
```

`./dev.sh` juga aman dijalankan setelah database dihapus: migrasi dan akun admin
dibuat ulang otomatis, hanya data contohnya yang perlu diisi lagi lewat
`./dev.sh seed`.

---

## Arsitektur

```
┌──────────────────────┐        ┌────────────────────────────┐      ┌──────────┐
│ web (nginx)          │  /api  │ api (FastAPI)              │      │ db       │
│  React SPA           ├───────►│  auth JWT · CRUD · upload  ├─────►│ Postgres │
│  port 8080           │ proxy  │  core/ = mesin K-Means     │      │          │
└──────────────────────┘        └────────────────────────────┘      └──────────┘
```

nginx melayani frontend sekaligus mem-proxy `/api`, sehingga frontend dan API
selalu satu origin — tidak ada CORS yang perlu diurus.

### Peran pengguna

| | Administrator | Head of Sales | Sales Executive |
|---|---|---|---|
| Pipeline & customer | seluruh tim | seluruh tim | **hanya miliknya** |
| Riwayat cluster | seluruh tim | seluruh tim | **hanya dirinya** |
| Jalankan segmentasi | ya | ya | tidak |
| Upload & Reports | ya | ya | tidak |
| Master data sales | ya | ya | tidak |
| Kelola akun pengguna | ya | tidak | tidak |

Pembatasan diterapkan **di query database**, bukan dengan menyembunyikan menu.
Seorang Sales Executive tidak akan menerima baris milik rekannya sekalipun ia
memanggil API secara langsung dengan nama orang lain.

Akun Sales Executive **wajib ditautkan** ke satu data sales — tautan itulah yang
menentukan pipeline siapa yang ia lihat. Akun yang belum ditautkan ditolak
dengan pesan jelas, bukan diam-diam diberi akses seluruh tim.

Tidak ada pendaftaran mandiri. Akun dibuat admin di menu **Manajemen User**.

### Alur segmentasi

```
Pipeline (deal per stage) → agregasi per sales
      → StandardScaler → K-Means (k=3, random_state=42, n_init=25) → Silhouette
      → skor komposit (Won positif; Lost & Hold negatif)
      → High / Medium / Low + rekomendasi
```

**K-Means hanya diimplementasikan sekali**, di `sales-segmentation/core/`.
Frontend tidak menghitung apa pun — ia hanya menampilkan hasil. Versi JavaScript
yang lama dihapus karena memakai `Math.random()` tanpa seed sehingga hasilnya
berubah setiap klik; untuk keputusan bonus dan PIP itu tidak bisa diterima.

Hasil pada data riil (akumulasi tahunan, N=10): **Silhouette 0.6516**, K=3
optimal. Angka ini dikunci oleh tes otomatis.

---

## Keamanan

- `SECRET_KEY` menandatangani token sesi. Bila bocor, siapa pun bisa memalsukan
  login sebagai admin. Aplikasi **menolak jalan** di produksi bila masih memakai
  nilai default.
- Password disimpan sebagai hash bcrypt, tidak pernah dalam bentuk asli.
- Port Postgres tidak dipublikasikan ke luar; hanya container `api` yang bisa
  menjangkaunya.
- Dokumentasi API interaktif (`/docs`) otomatis tertutup saat `APP_ENV=production`.
- `.env` memuat kredensial dan **tidak boleh di-commit**.

### HTTPS

TLS diterminasi di reverse proxy kantor; container `web` menerima permintaan
yang sudah didekripsi. Yang perlu diteruskan proxy tersebut:

```
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header Host              $host;
```

`X-Forwarded-Proto` menentukan dua hal: header **HSTS** hanya dikirim bila
permintaan aslinya HTTPS, dan uvicorn memakai skema yang benar untuk log serta
pembentukan URL. HSTS sengaja tidak dikirim pada koneksi HTTP — mengirimkannya
di lingkungan uji tanpa TLS akan membuat browser menolak membuka aplikasi
selama berbulan-bulan setelahnya.

Header yang selalu dikirim: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, dan `Permissions-Policy`.

Token sesi dikirim pada header tiap permintaan, jadi jangan menjalankan
aplikasi ini di HTTP bila bisa dijangkau dari luar jaringan kantor.

## Keterbatasan metode

Lihat [sales-segmentation/README.md](sales-segmentation/README.md): N kecil
(10 sales), fitur berbasis volume aktivitas, dan skor komposit yang hanya
bermakna di dalam satu periode analisis.

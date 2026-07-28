# Pipelio — Frontend

React + Vite. Seluruh data berasal dari backend FastAPI di `../sales-segmentation`.

Aplikasi ini **tidak lagi memakai Base44**. SDK, plugin Vite, dan mode mock lokal
sudah dihapus; lapisan data ada di `src/api/`.

## Menjalankan

Cara yang dianjurkan — dari folder induk, menjalankan backend + frontend
sekaligus beserta database dev:

```bash
cd ..
./dev.sh setup     # sekali saja
./dev.sh
```

Langkah lengkap, akun awal, dan penanganan masalah ada di
[README utama](../README.md#menjalankan-di-lokal-pengembangan).

Hanya frontend (backend harus sudah berjalan sendiri di port 8000):

```bash
npm install
npm run dev        # http://localhost:5173
```

Vite mem-proxy `/api` ke `http://localhost:8000`, jadi frontend dan backend
selalu satu origin — sama seperti di produksi, dan tidak ada CORS yang perlu
diurus. Ubah target lewat `VITE_API_PROXY_TARGET` bila backend ada di tempat
lain. Untuk pengembangan biasa `.env.local` tidak dibutuhkan sama sekali.

## Pemeriksaan sebelum commit

```bash
npm run check      # check:imports + lint + typecheck
npm run build
```

`npm run check:imports` memverifikasi setiap impor `@/...` menunjuk file yang ada.
Dibuat setelah seluruh aplikasi gagal build karena folder bernama `src/component/`
sementara 22 file mengimpor `@/components/` — kelas bug yang lolos dari lint
maupun typecheck.

## Struktur

| Path | Isi |
|---|---|
| `src/api/client.js` | Wrapper fetch: JWT, penanganan error, 401 |
| `src/api/entities.js` | Akses data per entity + endpoint segmentasi & upload |
| `src/lib/AuthContext.jsx` | Sesi login, role, ubah password |
| `src/components/ProtectedRoute.jsx` | Penjagaan rute (termasuk `adminOnly`) |
| `src/pages/` | Halaman aplikasi |
| `src/components/ui/` | Komponen shadcn (pihak ketiga) |

## Catatan

- Alias `@` didefinisikan di `vite.config.js`. Sebelumnya disediakan diam-diam
  oleh plugin Base44; setelah plugin dilepas, alias harus dideklarasikan sendiri.
- Tidak ada perhitungan clustering di frontend. Halaman segmentasi hanya
  memanggil `POST /api/segmentation/run` dan menampilkan hasilnya.
- Filter periode dikerjakan backend, bukan dengan mengambil N record terbaru
  lalu memilah di browser — cara itu membuat quarter tertua tidak pernah ikut
  terambil begitu data melewati batas limit.

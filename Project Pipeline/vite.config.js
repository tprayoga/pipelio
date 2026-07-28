import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Alias '@' sebelumnya disediakan diam-diam oleh @base44/vite-plugin. Setelah
// plugin itu dilepas, alias harus dideklarasikan di sini — tanpa ini seluruh
// impor '@/...' gagal resolve dan aplikasi tidak bisa di-build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Backend dipanggil lewat path relatif '/api', jadi frontend dan API
    // selalu satu origin — sama seperti di produksi (nginx mem-proxy /api).
    // Konsekuensinya tidak ada CORS yang perlu diurus di kedua lingkungan.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})

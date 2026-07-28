// Akses data untuk seluruh halaman.
//
// Bentuk pemanggilannya sengaja dipertahankan seperti SDK Base44 yang lama
// (`list(sort, limit)`, `filter(query)`, `create`, `update`, `delete`) supaya
// migrasi ini tidak menyentuh logika tiap halaman — hanya lapisan datanya yang
// berganti dari Base44 ke backend sendiri.

import { api } from "@/api/client";

function entity(path) {
  return {
    list: (sort, limit) => api.get(path, { sort, limit }),
    filter: (query = {}, sort, limit) => api.get(path, { ...query, sort, limit }),
    create: (data) => api.post(path, data),
    update: (id, data) => api.patch(`${path}/${id}`, data),
    delete: (id) => api.delete(`${path}/${id}`),
  };
}

export const Customer = entity("/customers");
export const Sales = entity("/sales");
export const Pipeline = entity("/pipelines");

export const ClusteringResult = {
  list: (sort, limit) => api.get("/segmentation/results", { sort, limit }),
  filter: (query = {}, sort, limit) =>
    api.get("/segmentation/results", { ...query, sort, limit }),
};

export const Segmentation = {
  /** Menjalankan K-Means di backend (core/clustering.py) dan menyimpan hasilnya. */
  run: ({ quarter, year, k = 3, save = true }) =>
    api.post("/segmentation/run", { quarter, year, k, save }),
  sweepK: ({ quarter, year, kValues = [2, 3, 4, 5] }) =>
    api.post("/segmentation/sweep-k", { quarter, year, k_values: kValues }),
  method: () => api.get("/segmentation/method"),
};

export const Uploads = {
  /** Mengunggah Excel/CSV dan mendapat pratinjau baris yang sudah dipetakan. */
  preview: (file) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload("/uploads/preview", form);
  },
  import: (rows) => api.post("/uploads/import", { rows }),
  /** Template Excel berisi kolom yang dikenali beserta contoh pengisian. */
  template: () => api.download("/uploads/template", "template_pipeline_pipelio.xlsx"),
};

export const Users = {
  list: () => api.get("/auth/users"),
  create: (data) => api.post("/auth/users", data),
  update: (id, data) => api.patch(`/auth/users/${id}`, data),
  resetPassword: (id, newPassword) =>
    api.post(`/auth/users/${id}/reset-password`, { new_password: newPassword }),
  delete: (id) => api.delete(`/auth/users/${id}`),
};

// Warna & urutan cluster dipakai bersama oleh halaman segmentasi, riwayat,
// dan laporan — didefinisikan sekali di sini.
export const CLUSTER_COLORS = {
  "High Performance": "#22C55E",
  "Medium Performance": "#F59E0B",
  "Low Performance": "#EF4444",
};

export const CLUSTER_ORDER = ["High Performance", "Medium Performance", "Low Performance"];

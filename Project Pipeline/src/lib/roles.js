// Peran pengguna — cerminan dari app/roles.py di backend.
//
// Ini hanya mengatur APA YANG TAMPIL. Penjagaan sebenarnya ada di backend:
// menyembunyikan menu bukan pengamanan, jadi setiap aturan di sini punya
// pasangannya di sisi server.

export const ADMIN = "admin";
export const HEAD_SALES = "head_sales";
export const SALES = "sales";

export const ROLE_LABELS = {
  [ADMIN]: "Administrator",
  [HEAD_SALES]: "Head of Sales",
  [SALES]: "Sales Executive",
};

const TEAM_WIDE = new Set([ADMIN, HEAD_SALES]);

/** Melihat data seluruh tim, bukan hanya miliknya sendiri. */
export const seesAllData = (role) => TEAM_WIDE.has(role);

/** Menjalankan proses segmentasi & melihat peringkat seluruh tim. */
export const canRunSegmentation = (role) => TEAM_WIDE.has(role);

/** Mengubah master sales dan mengimpor data massal. */
export const canManageMasterData = (role) => TEAM_WIDE.has(role);

/** Mengelola akun pengguna. */
export const canManageUsers = (role) => role === ADMIN;

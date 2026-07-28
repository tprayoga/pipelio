// Klien HTTP untuk backend Pipelio.
//
// Frontend dan API selalu berada di origin yang sama: saat dev, Vite mem-proxy
// /api ke uvicorn; di produksi, nginx melakukan hal yang sama. Karena itu
// base URL cukup path relatif dan tidak ada CORS yang perlu diurus.

const BASE_URL = "/api";
const TOKEN_KEY = "pipelio_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, body, options) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Dipanggil saat token ditolak, supaya AuthContext bisa memaksa login ulang. */
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function buildQuery(params) {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.append(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request(method, path, { body, params, isFormData = false } = {}) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(params)}`, {
      method,
      headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    // fetch hanya melempar untuk kegagalan jaringan, bukan status HTTP.
    throw new ApiError("Tidak bisa menghubungi server. Periksa koneksi Anda.", 0, null, { cause });
  }

  // 401 hanya berarti "sesi habis" bila permintaan ini memang membawa token.
  // Tanpa syarat itu, login dengan password salah — yang juga menjawab 401 —
  // akan menampilkan "Sesi berakhir" alih-alih "Email atau password salah".
  if (response.status === 401 && token) {
    setToken(null);
    onUnauthorized?.();
    throw new ApiError("Sesi berakhir. Silakan login kembali.", 401, null);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    let detail = `Permintaan gagal (${response.status})`;
    if (payload?.detail) {
      // FastAPI mengirim string untuk HTTPException, array untuk error validasi.
      detail = Array.isArray(payload.detail)
        ? payload.detail.map((d) => d.msg ?? JSON.stringify(d)).join("; ")
        : String(payload.detail);
    } else if (typeof payload === "string" && payload) {
      detail = payload;
    }
    throw new ApiError(detail, response.status, payload);
  }

  return payload;
}

/**
 * Unduh berkas dari endpoint yang butuh autentikasi.
 *
 * Tidak bisa memakai <a href> biasa: token dikirim lewat header Authorization,
 * dan navigasi langsung tidak membawanya. Jadi berkasnya diambil sebagai blob
 * lalu disimpan lewat tautan sementara.
 */
async function downloadFile(path, fallbackName) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (cause) {
    throw new ApiError("Tidak bisa menghubungi server. Periksa koneksi Anda.", 0, null, { cause });
  }

  if (response.status === 401 && token) {
    setToken(null);
    onUnauthorized?.();
    throw new ApiError("Sesi berakhir. Silakan login kembali.", 401, null);
  }
  if (!response.ok) {
    let detail = `Gagal mengunduh berkas (${response.status})`;
    try {
      const body = await response.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // Respons error bukan JSON — pakai pesan default.
    }
    throw new ApiError(detail, response.status, null);
  }

  // Nama berkas mengikuti Content-Disposition dari server bila ada.
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"';]+)"?/i);
  const filename = match?.[1] ?? fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Object URL menahan blob di memori sampai dicabut.
  URL.revokeObjectURL(url);

  return filename;
}

export const api = {
  get: (path, params) => request("GET", path, { params }),
  download: downloadFile,
  post: (path, body) => request("POST", path, { body }),
  patch: (path, body) => request("PATCH", path, { body }),
  delete: (path) => request("DELETE", path),
  upload: (path, formData) => request("POST", path, { body: formData, isFormData: true }),
};

import React, { useState, useEffect } from "react";
import { Pipeline, Uploads } from "@/api/entities";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const PREVIEW_ROWS = 20;

export default function UploadData() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [history, setHistory] = useState([]);
  const { toast } = useToast();

  useEffect(() => { loadHistory(); }, []);

  function loadHistory() {
    Pipeline.list("-created_date", 5)
      .then(setHistory)
      .catch(() => {});
  }

  function reset() {
    setPreview(null);
    setFile(null);
  }

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      await Uploads.template();
    } catch (err) {
      toast({ title: "Gagal mengunduh template", description: err.message, variant: "destructive" });
    }
    setDownloading(false);
  }

  async function handleFile(e) {
    const selected = e.target.files?.[0];
    // Input di-reset agar memilih file yang sama dua kali tetap memicu onChange.
    e.target.value = "";
    if (!selected) return;

    setFile(selected);
    setPreview(null);
    setUploading(true);
    try {
      // Pemetaan kolom dikerjakan backend (app/routers/uploads.py) — aturannya
      // eksplisit dan sama untuk setiap file, tidak menebak-nebak isi.
      const result = await Uploads.preview(selected);
      setPreview(result);
      toast({ title: "File terbaca", description: `${result.total} baris siap diimpor` });
    } catch (err) {
      setFile(null);
      toast({ title: "Gagal membaca file", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  }

  async function handleImport() {
    if (!preview?.rows?.length) return;
    setImporting(true);
    try {
      // Backend mengimpor seluruh baris dalam satu transaksi: bila ada yang
      // gagal, tidak ada satu pun yang masuk separuh.
      const { imported } = await Uploads.import(preview.rows);
      toast({ title: "Import berhasil", description: `${imported} pipeline ditambahkan` });
      reset();
      loadHistory();
    } catch (err) {
      toast({ title: "Gagal mengimpor", description: err.message, variant: "destructive" });
    }
    setImporting(false);
  }

  const previewRows = preview?.rows ?? [];
  const notShown = preview ? preview.total - Math.min(previewRows.length, PREVIEW_ROWS) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="font-semibold text-[#122E61] mb-1">Upload Data Pipeline</h2>
            <p className="text-xs text-gray-500 max-w-2xl">
              Format .xlsx, .xls, atau .csv — maksimal 10&nbsp;MB. Kolom wajib:
              <b> Customer</b> dan <b>Project Name</b>. Kolom lain (Stage, Sales Executive,
              Quarter, Year, Nilai) dikenali otomatis bila ada.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            disabled={downloading}
            className="flex-shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloading ? "Menyiapkan..." : "Unduh Template"}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Belum punya formatnya? Unduh template — sudah berisi seluruh kolom yang
          dikenali, dua baris contoh, dan sheet petunjuk pengisian.
        </p>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-12 cursor-pointer hover:border-[#2F6BFF] hover:bg-blue-50/30 transition-all">
          <div className="w-14 h-14 rounded-2xl bg-[#122E61] flex items-center justify-center mb-3">
            {uploading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Upload className="w-7 h-7 text-white" />
            )}
          </div>
          <p className="text-sm font-medium text-[#122E61]">
            {file ? file.name : "Klik untuk memilih file"}
          </p>
          <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {preview && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#22C55E]" />
              <h3 className="font-semibold text-[#122E61]">
                Pratinjau — {preview.total} baris siap diimpor
              </h3>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} disabled={importing}>
                <X className="w-4 h-4 mr-1" /> Batal
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="bg-[#22C55E] hover:bg-[#16A34A]"
              >
                {importing ? "Mengimpor..." : `Import ${preview.total} baris`}
              </Button>
            </div>
          </div>

          {preview.warnings?.length > 0 && (
            <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <ul className="space-y-0.5">
                {preview.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto max-h-96 border border-gray-100 rounded-xl">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {preview.columns.map((column) => (
                    <th key={column} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewRows.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {preview.columns.map((column) => (
                      <td key={column} className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {row[column] === null || row[column] === undefined || row[column] === ""
                          ? "-"
                          : String(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {notShown > 0 && (
            <p className="text-xs text-gray-400 text-center pt-2">
              Menampilkan {Math.min(previewRows.length, PREVIEW_ROWS)} baris pertama ·
              {" "}{notShown} baris lain ikut diimpor
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-[#122E61] mb-4">Pipeline Terbaru</h3>
        <div className="space-y-2">
          {history.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <CheckCircle className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#122E61] truncate">
                  {p.customer} — {p.project_name}
                </p>
                <p className="text-xs text-gray-400">{p.stage} • {p.quarter} {p.year}</p>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Belum ada data</p>
          )}
        </div>
      </div>
    </div>
  );
}

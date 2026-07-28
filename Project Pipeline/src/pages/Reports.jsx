import React, { useState, useEffect, useMemo } from "react";
import { Pipeline, ClusteringResult, CLUSTER_COLORS, CLUSTER_ORDER } from "@/api/entities";
import { FileText, Printer, AlertTriangle } from "lucide-react";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Logo from "@/components/Logo";

// Sejalan dengan core/insights.py — sumbernya dokumen rancangan penelitian.
const RECOMMENDATIONS = {
  "High Performance": [
    "Pertahankan strategi penjualan yang sudah berjalan",
    "Beri peluang menangani proyek bernilai besar",
    "Jadikan mentor bagi anggota tim lainnya",
  ],
  "Medium Performance": [
    "Berikan pendampingan saat proses negosiasi",
    "Lakukan monitoring performa secara berkala",
  ],
  "Low Performance": [
    "Lakukan coaching secara intensif",
    "Evaluasi kembali aktivitas pipeline",
    "Prioritaskan pendampingan dan tindak lanjut",
  ],
};

const ALL = "all";

export default function Reports() {
  const [pipelines, setPipelines] = useState([]);
  const [clusterResults, setClusterResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(ALL);
  const [quarter, setQuarter] = useState(ALL);

  useEffect(() => {
    async function loadData() {
      try {
        const [pipe, clusters] = await Promise.all([
          Pipeline.list("-created_date", 10000),
          ClusteringResult.list("-created_date", 10000),
        ]);
        setPipelines(pipe);
        setClusterResults(clusters);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    loadData();
  }, []);

  const years = useMemo(() => {
    const set = new Set([...pipelines, ...clusterResults].map((r) => r.year).filter(Boolean));
    return [...set].sort((a, b) => b - a);
  }, [pipelines, clusterResults]);

  const inPeriod = (r) =>
    (year === ALL || Number(r.year) === Number(year)) &&
    (quarter === ALL || r.quarter === quarter);

  const periodPipelines = pipelines.filter(inPeriod);
  const periodClusters = clusterResults.filter(inPeriod);

  const periodLabel =
    year === ALL && quarter === ALL
      ? "Seluruh periode"
      : `${quarter === ALL ? "Q1–Q4" : quarter} ${year === ALL ? "(semua tahun)" : year}`;

  /**
   * Silhouette adalah properti SATU proses clustering, bukan sesuatu yang bisa
   * dirata-ratakan lintas periode. Kalau filter masih mencakup lebih dari satu
   * proses, angkanya tidak bermakna — jadi dilaporkan sebagai "beragam".
   */
  const silhouetteValues = [
    ...new Set(
      periodClusters
        .map((r) => r.silhouette_score)
        .filter((v) => v != null)
        .map((v) => Number(v).toFixed(4))
    ),
  ];
  const singleRun = silhouetteValues.length === 1;
  const silhouette = singleRun ? Number(silhouetteValues[0]) : null;
  const mixedPeriods = new Set(periodClusters.map((r) => `${r.quarter} ${r.year}`)).size > 1;

  if (loading) {
    return <div className="flex justify-center h-64"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#122E61] rounded-full animate-spin" /></div>;
  }

  const totalPipeline = periodPipelines.length;
  const totalWon = periodPipelines.filter((p) => p.stage === "Won").length;
  const totalLost = periodPipelines.filter((p) => p.stage === "Lost").length;
  const wonRevenue = periodPipelines
    .filter((p) => p.stage === "Won")
    .reduce((s, p) => s + (p.estimated_value || 0), 0);
  const wonRate = totalPipeline > 0 ? totalWon / totalPipeline : 0;
  const lostRate = totalPipeline > 0 ? totalLost / totalPipeline : 0;

  const clusterCounts = CLUSTER_ORDER.map((c) => ({
    name: c,
    count: periodClusters.filter((r) => r.cluster === c).length,
    color: CLUSTER_COLORS[c],
  }));

  const qualityText =
    silhouette == null ? null
      : silhouette >= 0.5 ? "kualitas pemisahan cluster yang kuat"
      : silhouette >= 0.25 ? "kualitas pemisahan cluster yang cukup"
      : "kualitas pemisahan cluster yang lemah";

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#122E61] flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-[#122E61]">Sales Performance Report</h2>
            <p className="text-xs text-gray-500">Executive Summary & Cluster Analysis</p>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-32">
            <Label>Tahun</Label>
            <Select value={String(year)} onValueChange={setYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label>Quarter</Label>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua</SelectItem>
                {["Q1", "Q2", "Q3", "Q4"].map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => window.print()} className="bg-[#122E61] hover:bg-[#0F264F] h-10">
            <Printer className="w-4 h-4 mr-1" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {mixedPeriods && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 print:hidden">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            Filter saat ini mencakup beberapa periode clustering yang berbeda. Angka cluster
            dan Silhouette dari periode berbeda tidak sebanding — persempit ke satu quarter
            untuk laporan yang bisa diinterpretasikan.
          </p>
        </div>
      )}

      {/* Report Content - Printable */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 print:shadow-none print:border-0">
        <div className="border-b-2 border-[#122E61] pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Logo className="w-10 h-10 text-[#122E61] flex-shrink-0" />
              <div>
                <h1 className="text-2xl font-bold text-[#122E61]">Pipelio — Sales Performance Report</h1>
                <p className="text-sm text-gray-500">Segmentasi Performa Sales dengan K-Means Clustering</p>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p className="font-medium text-[#122E61]">{periodLabel}</p>
              <p>{formatDate(new Date().toISOString())}</p>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-[#122E61] mb-3">1. Executive Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              ["Total Pipeline", totalPipeline, "text-[#122E61]"],
              ["Won Rate", formatPercent(wonRate), "text-[#22C55E]"],
              ["Lost Rate", formatPercent(lostRate), "text-[#EF4444]"],
              ["Revenue (Won)", formatCurrency(wonRevenue), "text-[#122E61]"],
            ].map(([label, value, color]) => (
              <div key={label} className="bg-[#F7F9FC] rounded-xl p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Laporan ini menyajikan analisis performa Sales Executive untuk periode <b>{periodLabel}</b> berdasarkan
            data pipeline penjualan. Sistem menggunakan algoritma K-Means Clustering dengan k=3 untuk
            mengelompokkan performa sales ke dalam tiga kategori: High, Medium, dan Low Performance.
            {silhouette != null ? (
              <> Silhouette Score yang diperoleh adalah <b>{silhouette.toFixed(4)}</b>, menunjukkan {qualityText}.</>
            ) : periodClusters.length === 0 ? (
              <> Belum ada hasil segmentasi tersimpan untuk periode ini.</>
            ) : (
              <> Periode ini memuat lebih dari satu proses clustering, sehingga Silhouette Score
                tidak dilaporkan sebagai angka tunggal.</>
            )}
          </p>
        </section>

        {/* Cluster Analysis */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-[#122E61] mb-3">2. Cluster Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {clusterCounts.map((c) => (
              <div key={c.name} className="border-l-4 rounded-r-xl bg-[#F7F9FC] p-4" style={{ borderColor: c.color }}>
                <p className="font-bold text-[#122E61]">{c.name}</p>
                <p className="text-sm text-gray-500">{c.count} sales</p>
              </div>
            ))}
          </div>
          {clusterCounts.map((c) => (
            <div key={c.name} className="mb-3">
              <p className="font-medium text-sm text-[#122E61]">{c.name}:</p>
              <ul className="ml-6 text-sm text-gray-600">
                {RECOMMENDATIONS[c.name].map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </div>
          ))}
        </section>

        {/* Cluster Results Table */}
        {periodClusters.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold text-[#122E61] mb-3">3. Segmentation Results</h2>
            <table className="w-full text-sm border border-gray-200">
              <thead>
                <tr className="bg-[#122E61] text-white text-left">
                  <th className="px-3 py-2">Sales</th>
                  <th className="px-3 py-2">Periode</th>
                  <th className="px-3 py-2 text-right">Won</th>
                  <th className="px-3 py-2 text-right">Lost</th>
                  <th className="px-3 py-2 text-right">Hold</th>
                  <th className="px-3 py-2 text-right">Win %</th>
                  <th className="px-3 py-2 text-right">Skor</th>
                  <th className="px-3 py-2">Cluster</th>
                </tr>
              </thead>
              <tbody>
                {[...periodClusters]
                  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                  .map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="px-3 py-2">{r.sales_name}</td>
                      <td className="px-3 py-2">{r.quarter} {r.year}</td>
                      <td className="px-3 py-2 text-right">{r.won ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{r.lost ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{r.hold ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{formatPercent(r.win_rate)}</td>
                      <td className="px-3 py-2 text-right font-bold">{r.score?.toFixed(2) ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-1 rounded-full text-xs text-white whitespace-nowrap" style={{ background: CLUSTER_COLORS[r.cluster] }}>
                          {r.cluster?.replace(" Performance", "")}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Methodology */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-[#122E61] mb-3">4. Methodology</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• <b>Fitur:</b> jumlah deal per stage (Lead, Prospecting, Negotiating, Won, Lost, Hold)</p>
            <p>• <b>Normalisasi:</b> StandardScaler (z-score) sebelum clustering</p>
            <p>• <b>K-Means:</b> k=3, k-means++, n_init=25, random_state=42 (hasil deterministik)</p>
            <p>• <b>Pelabelan:</b> skor komposit (Won positif; Lost & Hold negatif) mengurutkan cluster → High/Medium/Low</p>
            <p>• <b>Evaluasi:</b> Silhouette Score{silhouette != null ? ` (${silhouette.toFixed(4)})` : ""}</p>
            <p>• <b>Win %:</b> Won / (Won + Lost + Hold) — bagian deal selesai yang berakhir menang</p>
          </div>
        </section>

        <div className="border-t border-gray-200 pt-4 mt-6 text-xs text-gray-400 text-center">
          <p>Report generated on {formatDate(new Date().toISOString())} • Pipelio Sales Intelligence Platform</p>
        </div>
      </div>
    </div>
  );
}

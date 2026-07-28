import React, { useState } from "react";
import { Segmentation, CLUSTER_COLORS, CLUSTER_ORDER } from "@/api/entities";
import { formatPercent } from "@/lib/format";
import { BarChart3, Sparkles, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

export default function SalesSegmentation() {
  const [segmentation, setSegmentation] = useState(null);
  const [sweep, setSweep] = useState(null);
  const [running, setRunning] = useState(false);
  const [year, setYear] = useState(2025);
  const [quarter, setQuarter] = useState("Q1");
  const [expandedCluster, setExpandedCluster] = useState(null);
  const { toast } = useToast();

  async function handleGenerate() {
    setRunning(true);
    setSweep(null);
    try {
      // Satu panggilan: backend mengambil pipeline periode ini, mengagregasi per
      // sales, menjalankan K-Means (core/clustering.py), lalu menyimpan hasilnya
      // dalam SATU transaksi. Sebelumnya langkah simpan dilakukan frontend
      // dengan hapus-lalu-tulis tanpa transaksi, sehingga kegagalan di tengah
      // bisa menghilangkan riwayat periode.
      const response = await Segmentation.run({ quarter, year: Number(year), k: 3 });

      setSegmentation({
        results: response.results.map((r) => ({
          ...r,
          cluster: r.cluster_name,
          winRate: r.win_rate,
          lossRate: r.loss_rate,
        })),
        clusterSummary: response.insights.map((i) => {
          const cluster = { High: "High Performance", Medium: "Medium Performance", Low: "Low Performance" }[i.label] ?? i.label;
          const members = response.results.filter((r) => r.cluster_name === cluster);
          return {
            name: cluster,
            color: CLUSTER_COLORS[cluster],
            count: i.jumlah_sales,
            avgWon: i.rata_won,
            avgLost: i.rata_lost,
            avgHold: i.rata_hold,
            avgWinRate: members.length
              ? members.reduce((s, m) => s + m.win_rate, 0) / members.length
              : 0,
            recommendations: i.rekomendasi ?? [],
          };
        }),
        silhouette: response.silhouette,
        featuresUsed: response.features_used,
        k: response.k,
        nRows: response.n_rows,
      });

      Segmentation.sweepK({ quarter, year: Number(year) })
        .then(setSweep)
        .catch((e) => console.error("sweep-k gagal:", e));

      toast({
        title: "Segmentasi berhasil",
        description:
          `Silhouette Score ${response.silhouette?.toFixed(4) ?? "N/A"}` +
          (response.saved ? " · hasil tersimpan" : ""),
      });
    } catch (e) {
      toast({ title: "Segmentasi gagal", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  const results = segmentation?.results ?? [];
  const summary = segmentation?.clusterSummary ?? [];
  const generated = Boolean(segmentation);

  // Diurutkan sekali lalu dipakai bersama oleh data DAN warna — Recharts
  // menerapkan <Cell> secara posisional, jadi keduanya wajib dari array sama.
  const rankedResults = [...results].sort((a, b) => b.score - a.score);

  const scatterData = CLUSTER_ORDER.map((cluster) => ({
    name: cluster,
    color: CLUSTER_COLORS[cluster],
    data: results
      .filter((r) => r.cluster === cluster)
      .map((r) => ({ x: r.won, y: r.lost + r.hold, z: r.lead, name: r.name })),
  })).filter((c) => c.data.length > 0);

  const radarData = [
    { metric: "Won", key: "avgWon" },
    { metric: "Lost", key: "avgLost" },
    { metric: "Hold", key: "avgHold" },
  ].map(({ metric, key }) => {
    const point = { metric };
    for (const cluster of CLUSTER_ORDER) {
      point[cluster] = summary.find((s) => s.name === cluster)?.[key] ?? 0;
    }
    return point;
  });

  const pieData = summary.map((s) => ({ name: s.name, value: s.count, color: s.color }));

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#122E61] flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-[#122E61]">Sales Performance Segmentation</h2>
            <p className="text-xs text-gray-500">
              K-Means Clustering — dihitung service Python yang sama dengan penelitian
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label>Tahun</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quarter</Label>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Q1", "Q2", "Q3", "Q4"].map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex items-end justify-end">
            <Button onClick={handleGenerate} disabled={running} className="bg-[#122E61] hover:bg-[#0F264F] h-10">
              <Sparkles className="w-4 h-4 mr-1" /> {running ? "Processing..." : "Generate Segmentation"}
            </Button>
          </div>
        </div>

        {/* Parameter metode — nilai nyata dari service, bukan badge dekoratif */}
        {generated && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            {[
              ["Algoritma", "K-Means"],
              ["Normalisasi", "StandardScaler"],
              ["K", segmentation.k],
              ["Sales dianalisis", segmentation.nRows],
              ["Fitur", segmentation.featuresUsed.join(", ")],
            ].map(([k, v]) => (
              <span key={k} className="px-3 py-1.5 rounded-lg bg-[#F7F9FC] text-gray-600 border border-gray-100">
                {k}: <b className="text-[#122E61]">{v}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {!generated ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Pilih tahun dan quarter, lalu klik <b>Generate Segmentation</b>.</p>
          <div className="mt-6 max-w-lg mx-auto text-left text-xs text-gray-400 space-y-1">
            <p>📋 Perhitungan dijalankan oleh service segmentasi:</p>
            <p>1. Agregasi pipeline per sales (6 stage)</p>
            <p>2. StandardScaler (normalisasi z-score)</p>
            <p>3. K-Means k=3 (random_state=42, n_init=25 — hasil deterministik)</p>
            <p>4. Silhouette Score</p>
            <p>5. Skor komposit → label High / Medium / Low</p>
            <p className="pt-2 text-gray-300">Perhitungan berjalan di server, bukan di browser.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Silhouette Score Banner */}
          <div className="bg-gradient-to-r from-[#122E61] to-[#2F6BFF] rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-white/70 text-sm">Silhouette Score</p>
                <p className="text-3xl font-bold">
                  {segmentation.silhouette != null ? segmentation.silhouette.toFixed(4) : "N/A"}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {segmentation.silhouette == null ? "Tidak dapat dihitung"
                    : segmentation.silhouette >= 0.5 ? "Pemisahan cluster kuat"
                    : segmentation.silhouette >= 0.25 ? "Pemisahan cluster cukup"
                    : "Pemisahan cluster lemah"}
                </p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-white/70 text-sm">Total Sales</p>
                  <p className="text-2xl font-bold">{results.length}</p>
                </div>
                <div>
                  <p className="text-white/70 text-sm">Clusters</p>
                  <p className="text-2xl font-bold">{segmentation.k}</p>
                </div>
              </div>
            </div>
          </div>

          {results.length < 10 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                Hanya {results.length} sales dianalisis. Pada N kecil, pembagian 3 cluster
                sensitif terhadap sedikit perubahan data — perlakukan hasil sebagai indikasi,
                bukan penilaian final.
              </p>
            </div>
          )}

          {/* Cluster Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summary.map((s) => (
              <div key={s.name} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                  <h3 className="font-bold text-[#122E61]">{s.name}</h3>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{s.count} sales</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center mb-3">
                  {[
                    ["Won", s.avgWon.toFixed(1)],
                    ["Lost", s.avgLost.toFixed(1)],
                    ["Hold", s.avgHold.toFixed(1)],
                    ["Win %", formatPercent(s.avgWinRate)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[10px] text-gray-400">{label}</p>
                      <p className="text-sm font-semibold" style={{ color: s.color }}>{value}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setExpandedCluster(expandedCluster === s.name ? null : s.name)}
                  className="w-full text-xs text-[#2F6BFF] hover:underline flex items-center justify-center gap-1"
                >
                  Rekomendasi {expandedCluster === s.name ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {expandedCluster === s.name && (
                  <div className="mt-2 space-y-1 pt-2 border-t border-gray-100">
                    {s.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="text-[#2F6BFF] mt-0.5">•</span> {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-[#122E61] mb-1">Sebaran Cluster</h3>
              <p className="text-xs text-gray-400 mb-4">Won vs Lost+Hold · ukuran titik = jumlah lead</p>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" dataKey="x" name="Won" tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="Lost + Hold" tick={{ fontSize: 11 }} />
                  <ZAxis type="number" dataKey="z" range={[60, 400]} name="Lead" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white p-2 rounded-lg shadow-lg border text-xs">
                        <b>{d.name}</b><br />Won: {d.x}<br />Lost+Hold: {d.y}<br />Lead: {d.z}
                      </div>
                    );
                  }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {scatterData.map((cluster) => (
                    <Scatter key={cluster.name} name={cluster.name} data={cluster.data} fill={cluster.color} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-[#122E61] mb-1">Perbandingan Cluster</h3>
              <p className="text-xs text-gray-400 mb-4">Rata-rata jumlah deal per sales</p>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e0e0e0" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fontSize: 9 }} angle={90} />
                  {CLUSTER_ORDER.map((cluster) => (
                    <Radar
                      key={cluster} name={cluster} dataKey={cluster}
                      stroke={CLUSTER_COLORS[cluster]} fill={CLUSTER_COLORS[cluster]} fillOpacity={0.3}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-[#122E61] mb-1">Skor Komposit per Sales</h3>
              <p className="text-xs text-gray-400 mb-4">Won positif · Lost & Hold negatif (z-score berbobot)</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rankedResults.map((r) => ({
                  name: r.name.split(" ")[0], score: Number(r.score.toFixed(2)), cluster: r.cluster,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {rankedResults.map((r, i) => <Cell key={i} fill={CLUSTER_COLORS[r.cluster]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-[#122E61] mb-4">Distribusi Cluster</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bukti pemilihan K */}
          {sweep?.sweep?.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-[#122E61] mb-1">Perbandingan Nilai K</h3>
              <p className="text-xs text-gray-400 mb-4">
                Silhouette tertinggi pada K={sweep.best_k ?? "—"}
                {sweep.best_k === 3 ? " — mendukung pemilihan K=3." : " — pertimbangkan meninjau ulang K."}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sweep.sweep.filter((s) => s.silhouette != null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="k" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} />
                  <Tooltip formatter={(v) => Number(v).toFixed(4)} />
                  <Line type="monotone" dataKey="silhouette" stroke="#2F6BFF" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Results Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#122E61]">Hasil Segmentasi Sales</h3>
              <p className="text-xs text-gray-400">{quarter} {year}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F9FC] text-left">
                    {["Sales Name", "Lead", "Prospecting", "Negotiating", "Won", "Lost", "Hold", "Win %", "Skor", "Cluster"].map((h, i) => (
                      <th key={h} className={`px-4 py-3 font-medium text-gray-600 ${i > 0 && i < 9 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rankedResults.map((r) => (
                    <tr key={r.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-[#122E61]">{r.name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.lead}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.prospecting}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.negotiation}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.won}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.lost}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.hold}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatPercent(r.winRate)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#122E61]">{r.score.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium text-white whitespace-nowrap" style={{ background: CLUSTER_COLORS[r.cluster] }}>
                          {r.cluster}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
              Win % = Won / (Won + Lost + Hold), yaitu bagian deal <i>yang sudah selesai</i> dan
              berakhir menang. Deal yang masih berjalan tidak ikut dihitung.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

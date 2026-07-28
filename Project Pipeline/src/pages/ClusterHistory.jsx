import React, { useState, useEffect } from "react";
import { ClusteringResult, CLUSTER_COLORS } from "@/api/entities";
import { History, ArrowDown } from "lucide-react";
import { formatPercent } from "@/lib/format";
import { useAuth } from "@/lib/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function ClusterHistory() {
  const { seesAllData } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSales, setSelectedSales] = useState("all");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await ClusteringResult.list("-created_date", 10000);
      setResults(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (loading) {
    return <div className="flex justify-center h-64"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#122E61] rounded-full animate-spin" /></div>;
  }

  const salesNames = [...new Set(results.map((r) => r.sales_name))];
  const filtered = selectedSales === "all" ? results : results.filter((r) => r.sales_name === selectedSales);

  // Group by sales_name -> timeline of quarters
  const timelineMap = {};
  filtered.forEach((r) => {
    if (!timelineMap[r.sales_name]) timelineMap[r.sales_name] = [];
    timelineMap[r.sales_name].push(r);
  });

  // Sort each timeline by year, quarter
  Object.keys(timelineMap).forEach((name) => {
    timelineMap[name].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.quarter.localeCompare(b.quarter);
    });
  });

  const quarters = ["Q1", "Q2", "Q3", "Q4"];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#122E61] flex items-center justify-center">
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-[#122E61]">Riwayat Cluster</h2>
            <p className="text-xs text-gray-500">
              {seesAllData
                ? "Perubahan cluster tiap quarter"
                : "Riwayat penilaian performa Anda tiap quarter"}
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <Label>Filter Sales</Label>
          <Select value={selectedSales} onValueChange={setSelectedSales}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sales</SelectItem>
              {salesNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-[#122E61] mb-4">Cluster Timeline</h3>
        <div className="space-y-6">
          {Object.keys(timelineMap).map((name) => {
            const timeline = timelineMap[name];
            return (
              <div key={name} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[#122E61] text-white flex items-center justify-center text-xs font-bold">
                    {name.charAt(0)}
                  </div>
                  <span className="font-medium text-[#122E61]">{name}</span>
                </div>
                <div className="flex items-center gap-1 ml-10 overflow-x-auto pb-2">
                  {timeline.map((r, i) => (
                    <div key={i} className="flex items-center flex-shrink-0">
                      <div className="flex flex-col items-center">
                        <div
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white whitespace-nowrap"
                          style={{ background: CLUSTER_COLORS[r.cluster] }}
                        >
                          {r.cluster.replace(" Performance", "")}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1">{r.quarter} {r.year}</span>
                        <span className="text-[10px] text-gray-300">{formatPercent(r.win_rate)} win</span>
                      </div>
                      {i < timeline.length - 1 && <ArrowDown className="w-4 h-4 text-gray-300 mx-2 rotate-[-90deg]" />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {Object.keys(timelineMap).length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>Belum ada history cluster. Jalankan segmentasi terlebih dahulu.</p>
            </div>
          )}
        </div>
      </div>

      {/* Comparison Table */}
      {Object.keys(timelineMap).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-[#122E61]">Quarterly Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F9FC] text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Sales</th>
                  {quarters.map((q) => <th key={q} className="px-4 py-3 font-medium text-gray-600">{q}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.keys(timelineMap).map((name) => {
                  const timeline = timelineMap[name];
                  return (
                    <tr key={name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-[#122E61]">{name}</td>
                      {quarters.map((q) => {
                        const r = timeline.find((t) => t.quarter === q);
                        return (
                          <td key={q} className="px-4 py-3">
                            {r ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium text-white" style={{ background: CLUSTER_COLORS[r.cluster] }}>
                                {r.cluster.replace(" Performance", "")}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
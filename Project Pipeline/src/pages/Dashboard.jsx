import React, { useState, useEffect } from "react";
import { Pipeline, Customer, Sales } from "@/api/entities";
import {
  TrendingUp, Users, Target, Trophy, XCircle, Activity, Plus, UserPlus,
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

const COLORS = ["#122E61", "#2F6BFF", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"];

function KPICard({ icon: Icon, label, value, color, trend, title }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        {/* min-w-0 + truncate: tanpa ini nilai panjang seperti total revenue
            meluber keluar kartu alih-alih dipotong rapi. */}
        <div className="min-w-0">
          <p className="text-sm text-gray-500 mb-1 truncate">{label}</p>
          <p className="text-2xl font-bold text-[#122E61] truncate" title={title ?? String(value)}>{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {trend && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {trend}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { seesAllData } = useAuth();
  const [pipelines, setPipelines] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Limit dibuat besar: KPI di bawah adalah TOTAL, jadi mengambil hanya
        // N record terbaru membuat semua angka diam-diam salah — dengan limit
        // 200 sebelumnya, dashboard hanya pernah melihat quarter terakhir.
        const [pipe, cust, sl] = await Promise.all([
          Pipeline.list("-created_date", 10000),
          Customer.list("-created_date", 10000),
          Sales.list("-created_date", 1000),
        ]);
        setPipelines(pipe);
        setCustomers(cust);
        setSales(sl);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#122E61] rounded-full animate-spin" />
      </div>
    );
  }

  const totalPipeline = pipelines.length;
  const totalLeads = pipelines.filter((p) => p.stage === "Leads").length;
  const totalWon = pipelines.filter((p) => p.stage === "Won").length;
  const totalHold = pipelines.filter((p) => p.stage === "Hold").length;
  const totalLost = pipelines.filter((p) => p.stage === "Lost").length;
  const wonRate = totalPipeline > 0 ? totalWon / totalPipeline : 0;
  const lostRate = totalPipeline > 0 ? totalLost / totalPipeline : 0;
  const conversionRate = totalLeads > 0 ? totalWon / totalLeads : 0;
  const totalValue = pipelines.reduce((s, p) => s + (p.estimated_value || 0), 0);

  // Pipeline per Quarter
  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  const quarterData = quarters.map((q) => {
    const qPipes = pipelines.filter((p) => p.quarter === q);
    return {
      quarter: q,
      pipeline: qPipes.length,
      won: qPipes.filter((p) => p.stage === "Won").length,
      value: qPipes.reduce((s, p) => s + (p.estimated_value || 0), 0),
    };
  });

  // Stage Distribution
  const stages = ["Leads", "Prospecting", "Negotiating", "Won", "Lost", "Hold"];
  const stageData = stages.map((s) => ({
    name: s,
    value: pipelines.filter((p) => p.stage === s).length,
  }));

  // Industry Distribution
  const industries = [...new Set(pipelines.map((p) => p.industry).filter(Boolean))];
  const industryData = industries.map((ind) => ({
    name: ind,
    value: pipelines.filter((p) => p.industry === ind).length,
  }));

  // Sales Performance
  const salesPerf = sales.map((s) => {
    const sPipes = pipelines.filter((p) => p.sales_name === s.name);
    return {
      name: s.name?.split(" ")[0],
      pipeline: sPipes.length,
      won: sPipes.filter((p) => p.stage === "Won").length,
    };
  }).filter((s) => s.pipeline > 0);

  // Revenue Forecast
  const forecastData = quarters.map((q) => ({
    quarter: q,
    revenue: pipelines
      .filter((p) => p.quarter === q && p.stage === "Won")
      .reduce((s, p) => s + (p.estimated_value || 0), 0),
  }));

  return (
    <div className="space-y-6">
      {/* Cakupan data dinyatakan terang-terangan: seorang Sales Executive hanya
          melihat pipeline miliknya, dan angka di bawah tidak boleh disalahartikan
          sebagai angka seluruh tim. */}
      {!seesAllData && (
        <p className="text-sm text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-3">
          Menampilkan <b>data pipeline Anda sendiri</b>. Angka seluruh tim hanya
          dapat dilihat Head of Sales.
        </p>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/pipeline" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#122E61] text-white rounded-xl text-sm font-medium hover:bg-[#0F264F] transition-colors">
          <Plus className="w-4 h-4" /> Tambah Pipeline
        </Link>
        <Link to="/customer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-[#122E61] rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <UserPlus className="w-4 h-4" /> Tambah Customer
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard icon={Users} label="Total Sales" value={formatNumber(sales.length)} color="bg-[#122E61]" />
        <KPICard icon={Activity} label="Total Pipeline" value={formatNumber(totalPipeline)} color="bg-[#2F6BFF]" />
        <KPICard icon={Target} label="Won Rate" value={formatPercent(wonRate)} color="bg-[#22C55E]" />
        <KPICard icon={XCircle} label="Lost Rate" value={formatPercent(lostRate)} color="bg-[#EF4444]" />
        <KPICard icon={TrendingUp} label="Conversion" value={formatPercent(conversionRate)} color="bg-[#F59E0B]" />
        <KPICard icon={Trophy} label="Total Revenue" value={formatCurrencyCompact(totalValue)} title={formatCurrency(totalValue)} color="bg-[#8B5CF6]" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#122E61] mb-4">Pipeline per Quarter</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={quarterData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="pipeline" fill="#2F6BFF" radius={[8, 8, 0, 0]} name="Total Pipeline" />
              <Bar dataKey="won" fill="#22C55E" radius={[8, 8, 0, 0]} name="Won" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#122E61] mb-4">Distribusi Stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={stageData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {stageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#122E61] mb-4">Sales Performance</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={salesPerf} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pipeline" fill="#122E61" radius={[0, 4, 4, 0]} name="Pipeline" />
              <Bar dataKey="won" fill="#22C55E" radius={[0, 4, 4, 0]} name="Won" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#122E61] mb-4">Revenue Forecast (Won)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2F6BFF" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#2F6BFF" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#2F6BFF" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-[#122E61] mb-4">Industry Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={industryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#122E61" radius={[8, 8, 0, 0]} name="Pipeline Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
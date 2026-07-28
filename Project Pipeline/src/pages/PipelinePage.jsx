import React, { useState, useEffect } from "react";
import { Pipeline, Customer } from "@/api/entities";
import {
  Plus, Search, Edit2, Trash2, KanbanSquare, Table2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const STAGES = ["Leads", "Prospecting", "Negotiating", "Won", "Lost", "Hold"];
const STAGE_COLORS = {
  Leads: "#2F6BFF", Prospecting: "#8B5CF6", Negotiating: "#F59E0B",
  Won: "#22C55E", Lost: "#EF4444", Hold: "#6B7280",
};

const emptyForm = {
  customer: "", company: "", industry: "", project_name: "", project_category: "",
  estimated_value: 0, estimated_closing: "", pic: "", email: "", phone: "", notes: "",
  stage: "Leads", sales_name: "", quarter: "Q1", year: new Date().getFullYear(), status: "Active",
};

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("kanban");
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pipe, cust] = await Promise.all([
        Pipeline.list("-created_date", 300),
        Customer.list("-created_date", 100),
      ]);
      setPipelines(pipe);
      setCustomers(cust);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({ ...emptyForm, ...p });
    setShowForm(true);
  }

  async function handleSave() {
    try {
      if (editing) {
        await Pipeline.update(editing.id, form);
        toast({ title: "Pipeline diperbarui" });
      } else {
        await Pipeline.create(form);
        toast({ title: "Pipeline ditambahkan" });
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleStageChange(id, newStage) {
    try {
      await Pipeline.update(id, { stage: newStage });
      loadData();
      toast({ title: `Stage diubah ke ${newStage}` });
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function handleDelete(id) {
    if (!confirm("Hapus pipeline ini?")) return;
    try {
      await Pipeline.delete(id);
      loadData();
      toast({ title: "Pipeline dihapus" });
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  const filtered = pipelines.filter((p) => {
    const matchSearch = p.customer?.toLowerCase().includes(search.toLowerCase()) ||
      p.project_name?.toLowerCase().includes(search.toLowerCase());
    const matchStage = filterStage === "all" || p.stage === filterStage;
    return matchSearch && matchStage;
  });

  const grouped = STAGES.map((s) => ({
    stage: s,
    items: filtered.filter((p) => p.stage === s),
  }));

  if (loading) {
    return <div className="flex justify-center h-64"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#122E61] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari..." className="pl-9 w-52" />
          </div>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Stage</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
            <button onClick={() => setView("kanban")} className={`p-2 rounded-md ${view === "kanban" ? "bg-[#122E61] text-white" : "text-gray-500"}`}>
              <KanbanSquare className="w-4 h-4" />
            </button>
            <button onClick={() => setView("table")} className={`p-2 rounded-md ${view === "table" ? "bg-[#122E61] text-white" : "text-gray-500"}`}>
              <Table2 className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={openAdd} className="bg-[#122E61] hover:bg-[#0F264F]">
            <Plus className="w-4 h-4 mr-1" /> Tambah Pipeline
          </Button>
        </div>
      </div>

      {/* Kanban View */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {grouped.map(({ stage, items }) => (
            <div key={stage} className="min-w-[260px] w-72 flex-shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_COLORS[stage] }} />
                  <h3 className="font-semibold text-sm text-[#122E61]">{stage}</h3>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {items.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-6 border-2 border-dashed border-gray-100 rounded-xl">No items</div>
                )}
                {items.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm text-[#122E61] truncate">{p.customer}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-[#122E61]"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 truncate">{p.project_name}</p>
                    <p className="text-sm font-semibold text-[#22C55E]">{formatCurrency(p.estimated_value)}</p>
                    {p.estimated_closing && <p className="text-[10px] text-gray-400 mt-1">Closing: {formatDate(p.estimated_closing)}</p>}
                    <Select value={p.stage} onValueChange={(v) => handleStageChange(p.id, v)}>
                      <SelectTrigger className="h-7 mt-2 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F9FC] text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Customer</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Project</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Industry</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Stage</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Value</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Closing</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Sales</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#122E61]">{p.customer}</td>
                    <td className="px-4 py-3 text-gray-600">{p.project_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.industry}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium text-white" style={{ background: STAGE_COLORS[p.stage] }}>
                        {p.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.estimated_value)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.estimated_closing)}</td>
                    <td className="px-4 py-3 text-gray-500">{p.sales_name || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-[#122E61]"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">Tidak ada data pipeline</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <PipelineForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        form={form}
        setForm={setForm}
        editing={editing}
        customers={customers}
      />
    </div>
  );
}

function PipelineForm({ open, onClose, onSave, form, setForm, editing, customers }) {
  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#122E61]">{editing ? "Edit Pipeline" : "Tambah Pipeline"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div>
            <Label>Customer *</Label>
            <Select value={form.customer} onValueChange={(v) => {
              const c = customers.find((c) => c.company === v);
              update("customer", v);
              if (c) { update("company", c.company); update("industry", c.industry); update("pic", c.pic); update("email", c.email); update("phone", c.phone); }
            }}>
              <SelectTrigger><SelectValue placeholder="Pilih customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.company}>{c.company}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Company</Label><Input value={form.company || ""} onChange={(e) => update("company", e.target.value)} /></div>
          <div>
            <Label>Industry</Label>
            <Input value={form.industry || ""} onChange={(e) => update("industry", e.target.value)} />
          </div>
          <div><Label>Project Name *</Label><Input value={form.project_name || ""} onChange={(e) => update("project_name", e.target.value)} /></div>
          <div><Label>Project Category</Label><Input value={form.project_category || ""} onChange={(e) => update("project_category", e.target.value)} /></div>
          <div><Label>Estimated Value (Rp)</Label><Input type="number" value={form.estimated_value || 0} onChange={(e) => update("estimated_value", Number(e.target.value))} /></div>
          <div><Label>Estimated Closing Date</Label><Input type="date" value={form.estimated_closing || ""} onChange={(e) => update("estimated_closing", e.target.value)} /></div>
          <div><Label>PIC</Label><Input value={form.pic || ""} onChange={(e) => update("pic", e.target.value)} /></div>
          <div><Label>Email</Label><Input value={form.email || ""} onChange={(e) => update("email", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} /></div>
          <div><Label>Sales Name</Label><Input value={form.sales_name || ""} onChange={(e) => update("sales_name", e.target.value)} /></div>
          <div>
            <Label>Stage</Label>
            <Select value={form.stage} onValueChange={(v) => update("stage", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quarter</Label>
            <Select value={form.quarter} onValueChange={(v) => update("quarter", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Q1", "Q2", "Q3", "Q4"].map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Year</Label><Input type="number" value={form.year || new Date().getFullYear()} onChange={(e) => update("year", Number(e.target.value))} /></div>
          <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={onSave} className="bg-[#122E61] hover:bg-[#0F264F]">Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
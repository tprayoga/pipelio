import React, { useState, useEffect } from "react";
import { Customer } from "@/api/entities";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const emptyForm = { company: "", pic: "", email: "", phone: "", industry: "", address: "" };

export default function CustomerPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await Customer.list("-created_date", 200);
      setCustomers(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(c) { setEditing(c); setForm({ ...emptyForm, ...c }); setShowForm(true); }

  async function handleSave() {
    try {
      if (editing) {
        await Customer.update(editing.id, form);
        toast({ title: "Customer diperbarui" });
      } else {
        await Customer.create(form);
        toast({ title: "Customer ditambahkan" });
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(id) {
    if (!confirm("Hapus customer ini?")) return;
    try {
      await Customer.delete(id);
      loadData();
      toast({ title: "Customer dihapus" });
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  }

  const filtered = customers.filter((c) =>
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.pic?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center h-64"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#122E61] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari customer..." className="pl-9 w-64" />
        </div>
        <Button onClick={openAdd} className="bg-[#122E61] hover:bg-[#0F264F]">
          <Plus className="w-4 h-4 mr-1" /> Tambah Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#122E61] text-white flex items-center justify-center font-bold text-sm">
                  {c.company?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-[#122E61]">{c.company}</p>
                  <p className="text-xs text-gray-500">{c.industry}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-[#122E61]"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-gray-600"><span className="text-gray-400">PIC:</span> {c.pic}</p>
              <p className="text-gray-600"><span className="text-gray-400">Email:</span> {c.email || "-"}</p>
              <p className="text-gray-600"><span className="text-gray-400">Phone:</span> {c.phone || "-"}</p>
              <p className="text-gray-600"><span className="text-gray-400">Address:</span> {c.address || "-"}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400">Tidak ada customer</div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#122E61]">{editing ? "Edit Customer" : "Tambah Customer"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2"><Label>Company *</Label><Input value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div><Label>PIC Name *</Label><Input value={form.pic || ""} onChange={(e) => setForm({ ...form, pic: e.target.value })} /></div>
            <div><Label>Industry *</Label><Input value={form.industry || ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={handleSave} className="bg-[#122E61] hover:bg-[#0F264F]">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
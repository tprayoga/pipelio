import React, { useState, useEffect } from "react";
import { Sales } from "@/api/entities";
import { Plus, Edit2, Trash2, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const emptyForm = { name: "", email: "", username: "", status: "Active", phone: "", target: 0 };

export default function SalesManagement() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await Sales.list("-created_date", 100);
      setSales(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(s) { setEditing(s); setForm({ ...emptyForm, ...s }); setShowForm(true); }

  async function handleSave() {
    try {
      if (editing) {
        await Sales.update(editing.id, form);
        toast({ title: "Sales diperbarui" });
      } else {
        await Sales.create(form);
        toast({ title: "Sales ditambahkan" });
      }
      setShowForm(false);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(id) {
    if (!confirm("Hapus sales ini?")) return;
    try {
      await Sales.delete(id);
      loadData();
      toast({ title: "Sales dihapus" });
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  }

  if (loading) {
    return <div className="flex justify-center h-64"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#122E61] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={openAdd} className="bg-[#122E61] hover:bg-[#0F264F]">
          <Plus className="w-4 h-4 mr-1" /> Tambah Sales
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Nama</th>
                <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 font-medium text-gray-600">Username</th>
                <th className="px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="px-4 py-3 font-medium text-gray-600">Target</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#122E61] text-white flex items-center justify-center text-xs font-bold">
                        {s.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="font-medium text-[#122E61]">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.email}</td>
                  <td className="px-4 py-3 text-gray-600">{s.username}</td>
                  <td className="px-4 py-3 text-gray-600">{s.phone || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{s.target ? new Intl.NumberFormat("id-ID").format(s.target) : "-"}</td>
                  <td className="px-4 py-3">
                    {s.status === "Active" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-50 text-green-600 font-medium">
                        <UserCheck className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-50 text-red-600 font-medium">
                        <UserX className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-[#122E61]"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Belum ada data sales</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#122E61]">{editing ? "Edit Sales" : "Tambah Sales"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nama Lengkap *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email *</Label><Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Username *</Label><Input value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Target</Label><Input type="number" value={form.target || 0} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
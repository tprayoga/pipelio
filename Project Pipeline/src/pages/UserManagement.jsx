import React, { useEffect, useState } from "react";
import { Users as UsersApi, Sales as SalesApi } from "@/api/entities";
import { ADMIN, HEAD_SALES, SALES, ROLE_LABELS } from "@/lib/roles";
import { useAuth } from "@/lib/AuthContext";
import { formatDate } from "@/lib/format";
import { UserCog, Plus, KeyRound, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const MIN_PASSWORD_LENGTH = 8;

const emptyForm = { email: "", full_name: "", password: "", role: SALES, sales_id: null };

const ROLE_OPTIONS = [
  { value: SALES, hint: "hanya pipeline miliknya sendiri" },
  { value: HEAD_SALES, hint: "seluruh data tim + segmentasi" },
  { value: ADMIN, hint: "seluruh akses + kelola akun" },
];

const UNLINKED = "__none__";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [userRows, salesRows] = await Promise.all([UsersApi.list(), SalesApi.list()]);
      setUsers(userRows);
      setSalesList(salesRows);
    } catch (e) {
      toast({ title: "Gagal memuat user", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: "Password terlalu pendek",
        description: `Minimal ${MIN_PASSWORD_LENGTH} karakter.`,
        variant: "destructive",
      });
      return;
    }
    // Sales Executive tanpa tautan tidak bisa melihat data apa pun — backend
    // menolaknya, jadi lebih baik dicegah sejak pembuatan akun.
    if (form.role === SALES && !form.sales_id) {
      toast({
        title: "Tautan sales belum dipilih",
        description: "Sales Executive harus ditautkan ke satu data sales agar bisa melihat pipeline-nya.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await UsersApi.create({ ...form, sales_id: form.role === SALES ? form.sales_id : null });
      toast({ title: "User dibuat", description: form.email });
      setShowCreate(false);
      setForm(emptyForm);
      load();
    } catch (e) {
      toast({ title: "Gagal membuat user", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleToggleActive(user) {
    try {
      await UsersApi.update(user.id, { is_active: !user.is_active });
      load();
    } catch (e) {
      toast({ title: "Gagal mengubah status", description: e.message, variant: "destructive" });
    }
  }

  async function handleRoleChange(user, role) {
    try {
      await UsersApi.update(user.id, { role });
      load();
    } catch (e) {
      toast({ title: "Gagal mengubah role", description: e.message, variant: "destructive" });
    }
  }

  async function handleReset() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: "Password terlalu pendek",
        description: `Minimal ${MIN_PASSWORD_LENGTH} karakter.`,
        variant: "destructive",
      });
      return;
    }
    try {
      await UsersApi.resetPassword(resetTarget.id, newPassword);
      toast({
        title: "Password direset",
        description: `Sampaikan password baru ke ${resetTarget.full_name} lewat jalur aman.`,
      });
      setResetTarget(null);
      setNewPassword("");
    } catch (e) {
      toast({ title: "Gagal mereset password", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Hapus akun ${user.email}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await UsersApi.delete(user.id);
      toast({ title: "User dihapus" });
      load();
    } catch (e) {
      toast({ title: "Gagal menghapus user", description: e.message, variant: "destructive" });
    }
  }

  if (loading) {
    return <div className="flex justify-center h-64"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#122E61] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#122E61] flex items-center justify-center">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-[#122E61]">Manajemen User</h2>
            <p className="text-xs text-gray-500">Akun untuk masuk ke aplikasi</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#122E61] hover:bg-[#0F264F]">
          <Plus className="w-4 h-4 mr-1" /> Tambah User
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-left">
                {["Nama", "Email", "Role", "Tertaut ke", "Status", "Dibuat", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id;
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#122E61]">
                      {user.full_name}
                      {isSelf && <span className="ml-2 text-[10px] text-gray-400">(Anda)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={user.role}
                        onValueChange={(v) => handleRoleChange(user, v)}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {ROLE_LABELS[option.value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.role === SALES
                        ? (salesList.find((sales) => sales.id === user.sales_id)?.name
                            ?? <span className="text-red-500 text-xs">belum ditautkan</span>)
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={isSelf}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        } ${isSelf ? "cursor-not-allowed opacity-60" : "hover:opacity-80"}`}
                      >
                        {user.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(user.created_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setResetTarget(user)}
                          title="Reset password"
                          className="text-gray-400 hover:text-[#122E61]"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={isSelf}
                          title={isSelf ? "Tidak bisa menghapus akun sendiri" : "Hapus"}
                          className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-[#122E61]">Tambah User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama Lengkap</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Password Awal</Label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">
                Minimal {MIN_PASSWORD_LENGTH} karakter. Minta user menggantinya setelah login pertama.
              </p>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {ROLE_LABELS[option.value]} — {option.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.role === SALES && (
              <div>
                <Label>Tautkan ke data sales</Label>
                <Select
                  value={form.sales_id ?? UNLINKED}
                  onValueChange={(v) => setForm({ ...form, sales_id: v === UNLINKED ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih sales" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNLINKED}>— belum dipilih —</SelectItem>
                    {salesList.map((sales) => (
                      <SelectItem key={sales.id} value={sales.id}>{sales.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">
                  Menentukan pipeline siapa yang bisa dilihat akun ini.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-[#122E61] hover:bg-[#0F264F]">
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#122E61] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-600">
              Password baru untuk <b>{resetTarget?.full_name}</b> ({resetTarget?.email}).
            </p>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Batal</Button>
            <Button onClick={handleReset} className="bg-[#122E61] hover:bg-[#0F264F]">Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

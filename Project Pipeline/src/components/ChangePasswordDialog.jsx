import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const MIN_LENGTH = 8;

export default function ChangePasswordDialog({ open, onOpenChange }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const { changePassword } = useAuth();
  const { toast } = useToast();

  function close() {
    setCurrent("");
    setNext("");
    setConfirm("");
    onOpenChange(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (next.length < MIN_LENGTH) {
      toast({
        title: "Password terlalu pendek",
        description: `Minimal ${MIN_LENGTH} karakter.`,
        variant: "destructive",
      });
      return;
    }
    if (next !== confirm) {
      toast({ title: "Konfirmasi tidak cocok", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await changePassword(current, next);
      toast({ title: "Password berhasil diubah" });
      close();
    } catch (err) {
      toast({ title: "Gagal mengubah password", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[#122E61]">Ubah Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="current-password">Password Saat Ini</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="new-password">Password Baru</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
            <p className="text-xs text-gray-400 mt-1">Minimal {MIN_LENGTH} karakter.</p>
          </div>
          <div>
            <Label htmlFor="confirm-password">Ulangi Password Baru</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Batal</Button>
            <Button type="submit" disabled={saving} className="bg-[#122E61] hover:bg-[#0F264F]">
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  UserCog,
  Upload,
  BarChart3,
  History,
  FileText,
  Menu,
  X,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import { ROLE_LABELS } from "@/lib/roles";

const menuItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Pipeline", path: "/pipeline", icon: KanbanSquare },
  { label: "Customer", path: "/customer", icon: Users },
  { label: "Sales Management", path: "/sales", icon: UserCog, requires: "canManageMasterData" },
  { label: "Upload Data", path: "/upload", icon: Upload, requires: "canManageMasterData" },
  { label: "Sales Segmentation", path: "/segmentation", icon: BarChart3, requires: "canRunSegmentation" },
  { label: "Riwayat Cluster", path: "/cluster-history", icon: History },
  { label: "Reports", path: "/reports", icon: FileText, requires: "canManageMasterData" },
  { label: "Manajemen User", path: "/users", icon: ShieldCheck, requires: "isAdmin" },
];

export default function AppLayout() {
  const auth = useAuth();
  const { user, logout } = auth;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const location = useLocation();

  // Menyembunyikan menu bukan pengamanan — rutenya dijaga ProtectedRoute dan
  // datanya dibatasi backend. Ini semata agar pengguna tidak melihat pintu
  // yang memang tidak bisa ia buka.
  const visibleMenu = menuItems.filter((item) => !item.requires || auth[item.requires]);

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#122E61] text-white flex-col transition-transform duration-300 lg:flex",
          sidebarOpen ? "translate-x-0 flex" : "-translate-x-full hidden lg:flex lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Logo className="w-8 h-8 text-[#2F6BFF]" />
            <div>
              <p className="text-sm font-bold leading-none">Pipelio</p>
              <p className="text-[10px] text-white/60">Sales Intelligence</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  active
                    ? "bg-[#2F6BFF] text-white font-medium"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#2F6BFF] flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.full_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-[10px] text-white/60 truncate">
                {ROLE_LABELS[user?.role] ?? user?.role}
              </p>
              <p className="text-[10px] text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPasswordDialog(true)}
              className="flex-1 text-[11px] text-white/70 hover:text-white hover:bg-white/10 rounded-lg py-1.5 transition-colors"
            >
              Ubah Password
            </button>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-1 text-[11px] text-white/70 hover:text-white hover:bg-white/10 rounded-lg py-1.5 px-2 transition-colors"
            >
              <LogOut className="w-3 h-3" /> Keluar
            </button>
          </div>
        </div>
      </aside>

      <ChangePasswordDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
              <Menu className="w-6 h-6 text-[#122E61]" />
            </button>
            <h1 className="text-lg font-semibold text-[#122E61]">
              {menuItems.find((m) => m.path === location.pathname)?.label || "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-sm text-gray-500">
              {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
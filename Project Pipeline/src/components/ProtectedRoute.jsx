import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const Loading = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

/**
 * `requires` menerima nama kemampuan dari AuthContext (mis. 'isAdmin',
 * 'canManageMasterData'). Rute yang tidak boleh diakses dialihkan ke dashboard,
 * bukan ditolak, supaya pengguna tidak terjebak di halaman kosong.
 */
export default function ProtectedRoute({ requires = null }) {
  const auth = useAuth();
  const { isAuthenticated, isLoadingAuth } = auth;
  const location = useLocation();

  if (isLoadingAuth) return <Loading />;

  // Alamat yang dituju disimpan agar setelah login user kembali ke halaman
  // yang tadi ia buka, bukan selalu ke dashboard.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requires && !auth[requires]) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

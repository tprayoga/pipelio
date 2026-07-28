import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import PipelinePage from '@/pages/PipelinePage';
import CustomerPage from '@/pages/CustomerPage';
import SalesManagement from '@/pages/SalesManagement';
import UploadData from '@/pages/UploadData';
import SalesSegmentation from '@/pages/SalesSegmentation';
import ClusterHistory from '@/pages/ClusterHistory';
import Reports from '@/pages/Reports';
import UserManagement from '@/pages/UserManagement';
import Login from '@/pages/Login';

// Aplikasi internal: tidak ada pendaftaran mandiri maupun reset password lewat
// email. Akun dibuat administrator di halaman Manajemen User.
function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Terbuka untuk semua peran; datanya sendiri yang dibatasi
                backend sesuai peran. */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pipeline" element={<PipelinePage />} />
                <Route path="/customer" element={<CustomerPage />} />
                <Route path="/cluster-history" element={<ClusterHistory />} />
              </Route>
            </Route>

            {/* Head of Sales & admin: alat pengelolaan tim. */}
            <Route element={<ProtectedRoute requires="canManageMasterData" />}>
              <Route element={<AppLayout />}>
                <Route path="/sales" element={<SalesManagement />} />
                <Route path="/upload" element={<UploadData />} />
                <Route path="/reports" element={<Reports />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute requires="canRunSegmentation" />}>
              <Route element={<AppLayout />}>
                <Route path="/segmentation" element={<SalesSegmentation />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute requires="isAdmin" />}>
              <Route element={<AppLayout />}>
                <Route path="/users" element={<UserManagement />} />
              </Route>
            </Route>

            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App

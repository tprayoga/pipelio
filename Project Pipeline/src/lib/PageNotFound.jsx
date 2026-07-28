import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import Logo from '@/components/Logo';

export default function PageNotFound() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const pageName = location.pathname.substring(1);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    <Logo className="w-12 h-12 mx-auto text-[#122E61]" />

                    <div className="space-y-2">
                        <h1 className="text-7xl font-light text-slate-300">404</h1>
                        <div className="h-0.5 w-16 bg-slate-200 mx-auto"></div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-medium text-slate-700">Halaman tidak ditemukan</h2>
                        <p className="text-sm text-slate-500">
                            {pageName
                                ? <>Alamat <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">/{pageName}</code> tidak ada.</>
                                : 'Alamat yang Anda tuju tidak ada.'}
                        </p>
                    </div>

                    <Link
                        to={isAuthenticated ? '/' : '/login'}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#122E61] text-white rounded-xl text-sm font-medium hover:bg-[#0F264F] transition-colors"
                    >
                        {isAuthenticated ? 'Kembali ke Dashboard' : 'Ke halaman login'}
                    </Link>
                </div>
            </div>
        </div>
    );
}

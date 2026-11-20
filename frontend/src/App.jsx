import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { CatalogPreviewPage } from './pages/CatalogPreviewPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminMoviesPage } from './pages/admin/AdminMoviesPage';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';

function AdminGuard({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0B0B0D] font-mono-ledger text-xs tracking-[0.2em] text-[#A59F95] uppercase">
        Đang kiểm tra phiên quản trị...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'admin') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0B0B0D] px-6 text-center text-[#F3EFE6]">
        <p className="font-mono-ledger text-xs tracking-[0.22em] text-[#D63628] uppercase">403 · Access Denied</p>
        <h1 className="font-editorial mt-2 text-3xl font-semibold">Khu vực chỉ dành cho Quản trị viên</h1>
        <p className="mt-3 max-w-md text-sm text-[#A59F95]">
          Tài khoản hiện tại ({user.email}) có quyền <code className="font-mono-ledger text-[#F3EFE6]">user</code>. Vui lòng quay lại kho phim hoặc đăng nhập bằng tài khoản Admin.
        </p>
        <a
          href="/catalog"
          className="mt-6 bg-[#F3EFE6] px-5 py-2.5 text-xs font-semibold tracking-wider text-[#0B0B0D] uppercase"
        >
          Về danh mục phim
        </a>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/catalog" element={<CatalogPreviewPage />} />
              <Route
                path="/admin"
                element={
                  <AdminGuard>
                    <AdminLayout />
                  </AdminGuard>
                }
              >
                <Route index element={<AdminDashboardPage />} />
                <Route path="movies" element={<AdminMoviesPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="reviews" element={<AdminReviewsPage />} />
              </Route>
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="*" element={<Navigate to="/catalog" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

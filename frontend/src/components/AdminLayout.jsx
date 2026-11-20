import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Clapperboard,
  Film,
  LogOut,
  Menu,
  MessageSquareQuote,
  Users,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/admin', end: true, label: 'Tổng quan', icon: BarChart3 },
  { to: '/admin/movies', end: false, label: 'Quản lý phim', icon: Film },
  { to: '/admin/users', end: false, label: 'Người dùng', icon: Users },
  { to: '/admin/reviews', end: false, label: 'Bình luận & Đánh giá', icon: MessageSquareQuote },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderNavContent = () => (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Brand Masthead */}
        <div className="border-b border-[#F3EFE6]/10 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center bg-[#D63628] text-[#F3EFE6]">
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-editorial text-xl font-bold tracking-tight text-[#F3EFE6] leading-none">
                CineVault
              </p>
              <p className="mt-1 text-[11px] text-[#746F67]">Quản trị hệ thống</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 py-5" aria-label="Điều hướng quản trị">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ to, end, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'border-l-[#D63628] bg-[#1B1B21] font-medium text-[#F3EFE6]'
                        : 'border-l-transparent text-[#A59F95] hover:bg-[#16161B] hover:text-[#F3EFE6]'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-[#F3EFE6]/10 pt-4">
            <NavLink
              to="/catalog"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 text-sm text-[#A59F95] transition-colors hover:bg-[#16161B] hover:text-[#F3EFE6]"
            >
              <span>Xem trang phim</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#746F67]" aria-hidden="true" />
            </NavLink>
          </div>
        </nav>
      </div>

      {/* Admin Profile + Sign Out */}
      <div className="border-t border-[#F3EFE6]/10 p-4">
        <div className="mb-3 px-2">
          <p className="truncate text-sm font-medium text-[#F3EFE6]">{user?.full_name}</p>
          <p className="truncate text-xs text-[#746F67]">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 border border-[#F3EFE6]/14 px-3 py-2 text-xs font-medium text-[#A59F95] transition-colors hover:border-[#E04848]/60 hover:bg-[#E04848]/10 hover:text-[#F3EFE6]"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="cinema-grain flex min-h-dvh bg-[#0B0B0D] text-[#F3EFE6]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[#F3EFE6] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#0B0B0D]"
      >
        Chuyển tới nội dung chính
      </a>

      {/* Desktop Left Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-[#F3EFE6]/10 bg-[#101014] lg:block">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu điều hướng">
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-64 border-r border-[#F3EFE6]/12 bg-[#101014]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Đóng menu"
              className="absolute right-4 top-5 text-[#A59F95] hover:text-[#F3EFE6]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {renderNavContent()}
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#F3EFE6]/10 bg-[#0B0B0D]/95 px-4 py-3.5 backdrop-blur-sm lg:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu điều hướng"
              className="border border-[#F3EFE6]/14 p-2 text-[#F3EFE6]"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="font-editorial text-lg font-bold tracking-tight">CineVault</span>
          </div>
          <span className="text-xs font-medium text-[#D63628]">Quản trị</span>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

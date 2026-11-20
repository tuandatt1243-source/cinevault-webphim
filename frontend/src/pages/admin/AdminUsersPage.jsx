import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Search,
  Shield,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserX,
} from 'lucide-react';
import { api } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const { pushToast } = useToast();

  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);

  const [pendingAction, setPendingAction] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminListUsers({
        q: q || undefined,
        role: role || undefined,
        is_active: activeFilter === '' ? undefined : activeFilter === 'true',
        page,
        limit: 20,
      });
      setUsers(res.items);
      setMeta(res.meta);
    } catch (err) {
      pushToast({ title: 'Lỗi tải danh sách thành viên', description: err.message, variant: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [q, role, activeFilter, page, pushToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const executeUpdate = async () => {
    if (!pendingAction) return;
    setBusy(true);
    try {
      await api.adminUpdateUser(pendingAction.target.id, pendingAction.payload);
      pushToast({
        title: 'Đã cập nhật tài khoản',
        description: pendingAction.successMsg,
        variant: 'success',
      });
      setPendingAction(null);
      fetchUsers();
    } catch (err) {
      pushToast({ title: 'Không thể cập nhật tài khoản', description: err.message, variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Masthead */}
      <div className="border-b border-[#F3EFE6]/10 pb-5">
        <h1 className="font-editorial text-3xl font-semibold text-[#F3EFE6]">
          Người dùng ({meta.total.toLocaleString('vi-VN')})
        </h1>
        <p className="mt-1 text-sm text-[#A59F95]">
          Quản lý tài khoản, trạng thái hoạt động và phân quyền hệ thống.
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="relative md:col-span-6">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746F67]" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo họ tên hoặc địa chỉ email..."
            aria-label="Tìm kiếm thành viên"
            className="w-full border border-[#F3EFE6]/14 bg-[#131317] py-2.5 pl-10 pr-4 text-sm text-[#F3EFE6] placeholder:text-[#746F67] focus:border-[#F3EFE6]/45 focus:outline-none"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo phân quyền"
            className="w-full border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2.5 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/45 focus:outline-none"
          >
            <option value="">Tất cả phân quyền</option>
            <option value="admin">Quản trị viên (Admin)</option>
            <option value="user">Thành viên (User)</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo trạng thái"
            className="w-full border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2.5 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/45 focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã tạm khóa</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-[#F3EFE6]/10 bg-[#131317]">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#F3EFE6]/10 bg-[#101014] font-mono-ledger text-[10px] tracking-[0.18em] text-[#746F67] uppercase">
              <th className="px-4 py-3.5">Thành viên</th>
              <th className="px-4 py-3.5">Phân quyền</th>
              <th className="px-4 py-3.5">Trạng thái</th>
              <th className="px-4 py-3.5">Hoạt động</th>
              <th className="px-4 py-3.5">Gu thể loại</th>
              <th className="px-4 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3EFE6]/8">
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-8 animate-pulse bg-[#1B1B21]" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#A59F95]">
                  Không tìm thấy thành viên nào khớp điều kiện lọc.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentAdmin?.id;
                const initials = u.full_name
                  .split(' ')
                  .slice(-2)
                  .map((s) => s[0])
                  .join('')
                  .toUpperCase();
                return (
                  <tr key={u.id} className="transition-colors hover:bg-[#1B1B21]/70">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#F3EFE6]/16 bg-[#0E0E12] font-mono-ledger text-xs font-semibold text-[#F3EFE6]">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#F3EFE6]">
                            {u.full_name}{' '}
                            {isSelf && (
                              <span className="ml-1 font-mono-ledger text-[10px] text-[#E0A43B] uppercase">
                                (Bạn)
                              </span>
                            )}
                          </p>
                          <p className="font-mono-ledger truncate text-xs text-[#746F67]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 border border-[#D63628]/45 bg-[#D63628]/12 px-2 py-1 font-mono-ledger text-[10px] font-semibold text-[#F3EFE6] uppercase">
                          <ShieldCheck className="h-3 w-3 text-[#D63628]" aria-hidden="true" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 border border-[#F3EFE6]/14 bg-[#0E0E12] px-2 py-1 font-mono-ledger text-[10px] text-[#A59F95] uppercase">
                          <Shield className="h-3 w-3 text-[#746F67]" aria-hidden="true" />
                          User
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#3DA86E]">
                          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#E04848]">
                          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                          Đã khóa
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono-ledger text-xs text-[#A59F95]">
                      <p>{u.review_count} đánh giá</p>
                      <p className="text-[#746F67]">{u.watchlist_count} watchlist</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {u.favorite_genres?.slice(0, 3).map((g) => (
                          <span key={g} className="border border-[#F3EFE6]/10 px-1.5 py-0.5 text-[11px] text-[#A59F95]">
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() =>
                            setPendingAction({
                              target: u,
                              payload: { role: u.role === 'admin' ? 'user' : 'admin' },
                              title:
                                u.role === 'admin'
                                  ? `Hạ quyền Admin của ${u.full_name}?`
                                  : `Cấp quyền Admin cho ${u.full_name}?`,
                              description:
                                u.role === 'admin'
                                  ? 'Tài khoản này sẽ không còn quyền truy cập trang quản trị.'
                                  : 'Tài khoản này sẽ có toàn quyền quản trị phim, người dùng và bình luận.',
                              confirmLabel: u.role === 'admin' ? 'Chuyển thành User' : 'Cấp quyền Admin',
                              variant: u.role === 'admin' ? 'danger' : 'neutral',
                              successMsg: `Đã đổi quyền của ${u.email} thành ${u.role === 'admin' ? 'user' : 'admin'}.`,
                            })
                          }
                          className="border border-[#F3EFE6]/16 px-2.5 py-1.5 text-xs text-[#A59F95] transition-colors hover:border-[#F3EFE6]/45 hover:text-[#F3EFE6] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          {u.role === 'admin' ? 'Hạ quyền' : 'Lên Admin'}
                        </button>

                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() =>
                            setPendingAction({
                              target: u,
                              payload: { is_active: !u.is_active },
                              title: u.is_active ? `Tạm khóa ${u.full_name}?` : `Mở khóa ${u.full_name}?`,
                              description: u.is_active
                                ? 'Người dùng sẽ bị chặn đăng nhập và mọi request dùng token hiện tại sẽ bị từ chối (403).'
                                : 'Tài khoản sẽ được khôi phục quyền truy cập hệ thống bình thường.',
                              confirmLabel: u.is_active ? 'Khóa tài khoản' : 'Mở khóa',
                              variant: u.is_active ? 'danger' : 'neutral',
                              successMsg: u.is_active ? `Đã khóa ${u.email}.` : `Đã mở khóa ${u.email}.`,
                            })
                          }
                          className={`inline-flex items-center gap-1 border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                            u.is_active
                              ? 'border-[#E04848]/35 text-[#E04848] hover:bg-[#E04848]/12'
                              : 'border-[#3DA86E]/40 text-[#3DA86E] hover:bg-[#3DA86E]/12'
                          }`}
                        >
                          {u.is_active ? (
                            <>
                              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                              Khóa
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                              Mở
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.total_pages > 1 && (
        <div className="flex items-center justify-between border-t border-[#F3EFE6]/10 pt-4">
          <p className="font-mono-ledger text-xs text-[#746F67]">
            Trang <span className="text-[#F3EFE6]">{meta.page}</span> / {meta.total_pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 border border-[#F3EFE6]/16 px-3 py-1.5 text-xs text-[#F3EFE6] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Trước
            </button>
            <button
              type="button"
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
              className="inline-flex items-center gap-1 border border-[#F3EFE6]/16 px-3 py-1.5 text-xs text-[#F3EFE6] disabled:opacity-40"
            >
              Sau
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title || ''}
        description={pendingAction?.description || ''}
        confirmLabel={pendingAction?.confirmLabel}
        variant={pendingAction?.variant}
        loading={busy}
        onConfirm={executeUpdate}
        onClose={() => setPendingAction(null)}
      />
    </div>
  );
}

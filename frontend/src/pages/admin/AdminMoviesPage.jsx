import { useCallback, useEffect, useState } from 'react';
import {
  ArchiveRestore,
  Eye,
  LayoutGrid,
  List,
  Pencil,
  Play,
  Plus,
  Search,
  Star,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MovieFormDrawer } from '../../components/MovieFormDrawer';
import { PosterImage } from '../../components/PosterImage';
import { TrailerModal } from '../../components/TrailerModal';
import { useToast } from '../../context/ToastContext';

export function AdminMoviesPage() {
  const { pushToast } = useToast();

  const [movies, setMovies] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, total_pages: 0 });
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState('rating');
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [viewMode, setViewMode] = useState('table'); // table | grid

  // Modals / Drawers
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [trailerMovie, setTrailerMovie] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    api.getGenres().then(setGenres).catch(() => {});
  }, []);

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listMovies({
        q: q || undefined,
        genre: genre || undefined,
        sort,
        status: statusFilter,
        page,
        limit: pageSize,
      });
      setMovies(res.items);
      setMeta(res.meta);
    } catch (err) {
      pushToast({ title: 'Lỗi tải danh sách phim', description: err.message, variant: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [q, genre, sort, statusFilter, page, pageSize, pushToast]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  const handleOpenCreate = () => {
    setEditingMovie(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (movie) => {
    setEditingMovie(movie);
    setDrawerOpen(true);
  };

  const handleSaveMovie = async (payload) => {
    setSaving(true);
    try {
      if (editingMovie) {
        await api.updateMovie(editingMovie.id, payload);
        pushToast({
          title: 'Đã cập nhật phim',
          description: `Thông tin phim “${payload.title}” đã được lưu.`,
          variant: 'success',
        });
      } else {
        await api.createMovie(payload);
        pushToast({
          title: 'Đã thêm phim mới',
          description: `“${payload.title}” đã được thêm vào danh mục.`,
          variant: 'success',
        });
      }
      setDrawerOpen(false);
      fetchMovies();
    } catch (err) {
      pushToast({ title: 'Không thể lưu phim', description: err.message, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (movie) => {
    try {
      await api.restoreMovie(movie.id);
      pushToast({
        title: 'Đã khôi phục phim',
        description: `“${movie.title}” đã hiển thị trở lại trong danh mục công khai.`,
        variant: 'success',
      });
      fetchMovies();
    } catch (err) {
      pushToast({ title: 'Khôi phục thất bại', description: err.message, variant: 'danger' });
    }
  };

  const handleConfirmSoftDelete = async () => {
    if (!confirmTarget) return;
    setActionBusy(true);
    const target = confirmTarget;
    try {
      await api.softDeleteMovie(target.id);
      setConfirmTarget(null);
      fetchMovies();
      pushToast({
        title: 'Đã chuyển phim vào thùng rác',
        description: `“${target.title}” đã tạm thời ẩn khỏi trang người dùng.`,
        variant: 'info',
        actionLabel: 'Hoàn tác ngay',
        onAction: () => handleRestore(target),
        duration: 7000,
      });
    } catch (err) {
      pushToast({ title: 'Xóa mềm thất bại', description: err.message, variant: 'danger' });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Masthead */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#F3EFE6]/10 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-[#F3EFE6]">
            Quản lý phim ({meta.total.toLocaleString('vi-VN')})
          </h1>
          <p className="mt-1 text-sm text-[#A59F95]">
            Thêm mới, chỉnh sửa thông tin, xem thử trailer và quản lý trạng thái hiển thị phim.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex border border-[#F3EFE6]/14 bg-[#131317]" role="group" aria-label="Chế độ hiển thị">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Chế độ bảng"
              aria-pressed={viewMode === 'table'}
              className={`px-3 py-2 text-xs transition-colors ${
                viewMode === 'table' ? 'bg-[#F3EFE6] text-[#0B0B0D]' : 'text-[#A59F95] hover:text-[#F3EFE6]'
              }`}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Chế độ lưới Poster"
              aria-pressed={viewMode === 'grid'}
              className={`px-3 py-2 text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-[#F3EFE6] text-[#0B0B0D]' : 'text-[#A59F95] hover:text-[#F3EFE6]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-[#D63628] px-4 py-2.5 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase transition-colors hover:bg-[#E54739]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Thêm phim mới</span>
          </button>
        </div>
      </div>

      {/* Status Tabs + Search & Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#F3EFE6]/10">
          {[
            { key: 'active', label: 'Đang hiển thị' },
            { key: 'deleted', label: 'Thùng rác (Xóa mềm)' },
            { key: 'all', label: 'Tất cả hồ sơ' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium tracking-wider uppercase transition-colors ${
                statusFilter === tab.key
                  ? 'border-b-[#D63628] text-[#F3EFE6]'
                  : 'border-b-transparent text-[#746F67] hover:text-[#F3EFE6]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746F67]" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên phim, đạo diễn, diễn viên..."
              aria-label="Tìm kiếm phim"
              className="w-full border border-[#F3EFE6]/14 bg-[#131317] py-2.5 pl-10 pr-4 text-sm text-[#F3EFE6] placeholder:text-[#746F67] focus:border-[#F3EFE6]/45 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc theo thể loại"
              className="w-full border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2.5 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/45 focus:outline-none"
            >
              <option value="">Tất cả thể loại</option>
              {genres.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name} ({g.count})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              aria-label="Sắp xếp phim"
              className="w-full border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2.5 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/45 focus:outline-none"
            >
              <option value="rating">Sắp xếp: Điểm cao nhất</option>
              <option value="newest">Sắp xếp: Năm phát hành mới nhất</option>
              <option value="views">Sắp xếp: Lượt xem nhiều nhất</option>
              <option value="created">Sắp xếp: Mới thêm vào kho</option>
              <option value="title">Sắp xếp: Tên A → Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area: Table or Poster Contact Sheet */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-20 animate-pulse border border-[#F3EFE6]/8 bg-[#131317]" />
          ))}
        </div>
      ) : movies.length === 0 ? (
        <div className="border border-[#F3EFE6]/10 bg-[#131317] px-6 py-16 text-center">
          <p className="font-editorial text-2xl text-[#F3EFE6]">Không tìm thấy tác phẩm phù hợp</p>
          <p className="mt-2 text-sm text-[#A59F95]">
            {statusFilter === 'deleted'
              ? 'Thùng rác hiện đang trống — chưa có phim nào bị xóa mềm.'
              : 'Thử thay đổi từ khóa tìm kiếm, thể loại hoặc thêm phim mới vào kho.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto border border-[#F3EFE6]/10 bg-[#131317]">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#F3EFE6]/10 bg-[#101014] font-mono-ledger text-[10px] tracking-[0.18em] text-[#746F67] uppercase">
                <th className="px-4 py-3.5">Tác phẩm</th>
                <th className="px-4 py-3.5">Thể loại</th>
                <th className="px-4 py-3.5">Năm / Thời lượng</th>
                <th className="px-4 py-3.5">Đánh giá</th>
                <th className="px-4 py-3.5">Trạng thái</th>
                <th className="px-4 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3EFE6]/8">
              {movies.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-[#1B1B21]/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 shrink-0">
                        <PosterImage movieId={m.id} src={m.poster_url} title={m.title} year={m.release_year} size="xs" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-editorial truncate text-base font-medium text-[#F3EFE6]">
                          {m.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#A59F95]">
                          {m.directors?.length ? `Đạo diễn: ${m.directors.join(', ')}` : 'Chưa rõ đạo diễn'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.genres.slice(0, 3).map((g) => (
                        <span
                          key={g}
                          className="border border-[#F3EFE6]/12 bg-[#0E0E12] px-2 py-0.5 text-[11px] text-[#A59F95]"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono-ledger text-xs text-[#A59F95]">
                    <p className="text-[#F3EFE6]">{m.release_year}</p>
                    <p className="mt-0.5 text-[#746F67]">
                      {m.runtime_minutes} min {m.certificate ? `· ${m.certificate}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono-ledger text-xs">
                    <div className="flex items-center gap-1.5 text-[#E0A43B]">
                      <Star className="h-3.5 w-3.5 fill-[#E0A43B]" aria-hidden="true" />
                      <span className="font-semibold">{m.avg_rating.toFixed(2)}</span>
                      <span className="text-[#746F67]">({m.rating_count})</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-[#746F67]">
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      <span>{m.views_count.toLocaleString('vi-VN')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {m.is_deleted ? (
                      <span className="inline-flex items-center gap-1.5 border border-[#E04848]/35 bg-[#E04848]/10 px-2 py-1 font-mono-ledger text-[10px] text-[#E04848] uppercase">
                        Đã xóa mềm
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 border border-[#3DA86E]/35 bg-[#3DA86E]/10 px-2 py-1 font-mono-ledger text-[10px] text-[#3DA86E] uppercase">
                        Đang chiếu
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTrailerMovie(m)}
                        aria-label={`Xem trailer ${m.title}`}
                        title="Xem thử Trailer"
                        className="inline-flex items-center gap-1 border border-[#E0A43B]/35 bg-[#E0A43B]/10 px-2.5 py-1.5 text-xs text-[#E0A43B] transition-colors hover:bg-[#E0A43B]/20"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        Trailer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(m)}
                        aria-label={`Chỉnh sửa ${m.title}`}
                        className="inline-flex items-center gap-1 border border-[#F3EFE6]/16 px-2.5 py-1.5 text-xs text-[#F3EFE6] transition-colors hover:border-[#F3EFE6]/45 hover:bg-[#23232B]"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Sửa
                      </button>
                      {m.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => handleRestore(m)}
                          aria-label={`Khôi phục ${m.title}`}
                          className="inline-flex items-center gap-1 border border-[#3DA86E]/40 bg-[#3DA86E]/10 px-2.5 py-1.5 text-xs text-[#3DA86E] transition-colors hover:bg-[#3DA86E]/20"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                          Khôi phục
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmTarget(m)}
                          aria-label={`Xóa mềm ${m.title}`}
                          className="inline-flex items-center gap-1 border border-[#E04848]/30 px-2.5 py-1.5 text-xs text-[#E04848] transition-colors hover:border-[#E04848] hover:bg-[#E04848]/12"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Poster Contact-Sheet Grid View */
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {movies.map((m) => (
            <article key={m.id} className="group flex flex-col border border-[#F3EFE6]/10 bg-[#131317]">
              <div className="relative overflow-hidden">
                <PosterImage
                  movieId={m.id}
                  src={m.poster_url}
                  title={m.title}
                  year={m.release_year}
                  className="group-hover:scale-[1.03]"
                />
                <div className="absolute left-2 top-2 bg-[#0B0B0D]/90 px-1.5 py-0.5 font-mono-ledger text-[10px] text-[#E0A43B] border border-[#E0A43B]/30">
                  ★ {m.avg_rating.toFixed(1)}
                </div>
                {m.is_deleted && (
                  <div className="absolute inset-x-0 bottom-0 bg-[#D63628]/90 py-1 text-center font-mono-ledger text-[10px] font-semibold tracking-wider text-[#F3EFE6] uppercase">
                    Đã xóa mềm
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between p-3">
                <div>
                  <h3 className="font-editorial line-clamp-1 text-sm font-semibold text-[#F3EFE6]" title={m.title}>
                    {m.title}
                  </h3>
                  <p className="font-mono-ledger mt-1 text-[11px] text-[#746F67]">
                    {m.release_year} · {m.runtime_minutes}m
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1.5 border-t border-[#F3EFE6]/8 pt-2.5">
                  <button
                    type="button"
                    onClick={() => setTrailerMovie(m)}
                    aria-label={`Xem trailer ${m.title}`}
                    className="border border-[#E0A43B]/35 bg-[#E0A43B]/10 px-2 py-1.5 text-[11px] font-medium text-[#E0A43B] hover:bg-[#E0A43B]/20"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(m)}
                    className="flex-1 border border-[#F3EFE6]/16 py-1.5 text-[11px] font-medium text-[#F3EFE6] hover:bg-[#1F1F27]"
                  >
                    Sửa
                  </button>
                  {m.is_deleted ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(m)}
                      className="flex-1 border border-[#3DA86E]/40 py-1.5 text-[11px] font-medium text-[#3DA86E] hover:bg-[#3DA86E]/15"
                    >
                      Khôi phục
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmTarget(m)}
                      className="flex-1 border border-[#E04848]/30 py-1.5 text-[11px] font-medium text-[#E04848] hover:bg-[#E04848]/12"
                    >
                      Xóa mềm
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {meta.total_pages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#F3EFE6]/10 pt-4">
          <p className="font-mono-ledger text-xs text-[#746F67]">
            Trang <span className="text-[#F3EFE6]">{meta.page}</span> / {meta.total_pages} · Tổng{' '}
            <span className="text-[#F3EFE6]">{meta.total.toLocaleString('vi-VN')}</span> phim
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Số phim mỗi trang"
              className="border border-[#F3EFE6]/16 bg-[#131317] px-2.5 py-1.5 text-xs text-[#F3EFE6]"
            >
              <option value={20}>20 / trang</option>
              <option value={30}>30 / trang</option>
              <option value={60}>60 / trang</option>
              <option value={100}>100 / trang</option>
            </select>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 border border-[#F3EFE6]/16 px-3 py-1.5 text-xs text-[#F3EFE6] transition-colors hover:bg-[#1B1B21] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Trước
            </button>
            <button
              type="button"
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
              className="inline-flex items-center gap-1 border border-[#F3EFE6]/16 px-3 py-1.5 text-xs text-[#F3EFE6] transition-colors hover:bg-[#1B1B21] disabled:opacity-40"
            >
              Sau
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Editorial Film Drawer */}
      <MovieFormDrawer
        open={drawerOpen}
        movie={editingMovie}
        saving={saving}
        onSubmit={handleSaveMovie}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Soft-Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={`Chuyển “${confirmTarget?.title || ''}” vào thùng rác?`}
        description="Phim sẽ tạm thời ẩn khỏi trang người dùng nhưng toàn bộ đánh giá vẫn được giữ nguyên. Bạn có thể khôi phục lại bất cứ lúc nào trong mục Thùng rác."
        confirmLabel="Chuyển vào thùng rác"
        loading={actionBusy}
        onConfirm={handleConfirmSoftDelete}
        onClose={() => setConfirmTarget(null)}
      />

      {/* Screening Room Trailer Modal */}
      <TrailerModal
        open={Boolean(trailerMovie)}
        movie={trailerMovie}
        onClose={() => setTrailerMovie(null)}
      />
    </div>
  );
}

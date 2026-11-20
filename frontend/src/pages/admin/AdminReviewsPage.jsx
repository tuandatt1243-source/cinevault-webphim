import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Search,
  Trash2,
} from 'lucide-react';
import { api } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PosterImage } from '../../components/PosterImage';
import { RatingStars } from '../../components/RatingStars';
import { useToast } from '../../context/ToastContext';

export function AdminReviewsPage() {
  const { pushToast } = useToast();

  const [reviews, setReviews] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [rating, setRating] = useState('');
  const [hiddenFilter, setHiddenFilter] = useState('');
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminListReviews({
        q: q || undefined,
        rating: rating ? Number(rating) : undefined,
        is_hidden: hiddenFilter === '' ? undefined : hiddenFilter === 'true',
        page,
        limit: 20,
      });
      setReviews(res.items);
      setMeta(res.meta);
    } catch (err) {
      pushToast({ title: 'Lỗi tải danh sách bình luận', description: err.message, variant: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [q, rating, hiddenFilter, page, pushToast]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleToggleHide = async (rev) => {
    try {
      const nextHidden = !rev.is_hidden;
      await api.adminModerateReview(rev.id, nextHidden);
      pushToast({
        title: nextHidden ? 'Đã ẩn bình luận' : 'Đã hiển thị lại bình luận',
        description: `Cập nhật trạng thái bình luận của ${rev.user_name || 'người dùng'}.`,
        variant: 'success',
      });
      fetchReviews();
    } catch (err) {
      pushToast({ title: 'Thao tác thất bại', description: err.message, variant: 'danger' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.deleteReview(deleteTarget.id);
      pushToast({
        title: 'Đã xóa bình luận',
        description: 'Điểm đánh giá trung bình của phim đã được cập nhật.',
        variant: 'info',
      });
      setDeleteTarget(null);
      fetchReviews();
    } catch (err) {
      pushToast({ title: 'Xóa bình luận thất bại', description: err.message, variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#F3EFE6]/10 pb-5">
        <h1 className="font-editorial text-3xl font-semibold text-[#F3EFE6]">
          Bình luận & Đánh giá ({meta.total.toLocaleString('vi-VN')})
        </h1>
        <p className="mt-1 text-sm text-[#A59F95]">
          Kiểm tra, ẩn hoặc xóa các bình luận vi phạm tiêu chuẩn cộng đồng.
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
            placeholder="Tìm theo nội dung bình luận, tên phim, tác giả..."
            aria-label="Tìm kiếm bình luận"
            className="w-full border border-[#F3EFE6]/14 bg-[#131317] py-2.5 pl-10 pr-4 text-sm text-[#F3EFE6] placeholder:text-[#746F67] focus:border-[#F3EFE6]/45 focus:outline-none"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={rating}
            onChange={(e) => {
              setRating(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo số sao"
            className="w-full border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2.5 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/45 focus:outline-none"
          >
            <option value="">Tất cả số sao</option>
            <option value="5">5 sao</option>
            <option value="4">4 sao</option>
            <option value="3">3 sao</option>
            <option value="2">2 sao</option>
            <option value="1">1 sao</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={hiddenFilter}
            onChange={(e) => {
              setHiddenFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo trạng thái hiển thị"
            className="w-full border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2.5 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/45 focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="false">Đang công khai</option>
            <option value="true">Đang bị ẩn</option>
          </select>
        </div>
      </div>

      {/* Editorial Review Ledger */}
      <div className="divide-y divide-[#F3EFE6]/10 border border-[#F3EFE6]/10 bg-[#131317]">
        {loading ? (
          [1, 2, 3, 4].map((n) => (
            <div key={n} className="p-5">
              <div className="h-16 animate-pulse bg-[#1B1B21]" />
            </div>
          ))
        ) : reviews.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-[#A59F95]">
            Không có đánh giá nào khớp bộ lọc hiện tại.
          </div>
        ) : (
          reviews.map((rev) => (
            <article
              key={rev.id}
              className={`flex flex-col justify-between gap-4 p-5 transition-colors hover:bg-[#1B1B21]/60 md:flex-row md:items-start ${
                rev.is_hidden ? 'opacity-75' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 gap-4">
                <div className="w-12 shrink-0">
                  <PosterImage movieId={rev.movie_id} src={rev.movie_poster_url} title={rev.movie_title} size="xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-editorial text-lg font-medium text-[#F3EFE6]">
                      {rev.movie_title || 'Phim không xác định'}
                    </h3>
                    <RatingStars value={rev.rating} size="sm" />
                    <span className="font-mono-ledger text-xs font-semibold text-[#E0A43B]">
                      {rev.rating}/5
                    </span>
                    {rev.is_hidden ? (
                      <span className="border border-[#D99B26]/40 bg-[#D99B26]/10 px-2 py-0.5 font-mono-ledger text-[10px] text-[#D99B26] uppercase">
                        Đã ẩn
                      </span>
                    ) : (
                      <span className="border border-[#3DA86E]/35 bg-[#3DA86E]/10 px-2 py-0.5 font-mono-ledger text-[10px] text-[#3DA86E] uppercase">
                        Công khai
                      </span>
                    )}
                  </div>

                  <p className="mt-2 border-l-2 border-[#F3EFE6]/14 pl-3 text-sm leading-relaxed text-[#D8D3C8]">
                    {rev.comment || <span className="italic text-[#746F67]">(Chỉ chấm điểm, không có bình luận)</span>}
                  </p>

                  <p className="font-mono-ledger mt-2.5 text-[11px] text-[#746F67]">
                    {rev.user_name || 'Ẩn danh'} ({rev.user_email || '—'}) ·{' '}
                    {new Date(rev.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleHide(rev)}
                  className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors ${
                    rev.is_hidden
                      ? 'border-[#3DA86E]/40 text-[#3DA86E] hover:bg-[#3DA86E]/12'
                      : 'border-[#D99B26]/40 text-[#D99B26] hover:bg-[#D99B26]/12'
                  }`}
                >
                  {rev.is_hidden ? (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Hiện lại
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      Ẩn đi
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(rev)}
                  className="inline-flex items-center gap-1.5 border border-[#E04848]/35 px-3 py-1.5 text-xs font-medium text-[#E04848] transition-colors hover:bg-[#E04848]/12"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Xóa
                </button>
              </div>
            </article>
          ))
        )}
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
        open={Boolean(deleteTarget)}
        title="Xóa vĩnh viễn bình luận?"
        description={`Bình luận của ${deleteTarget?.user_name || 'thành viên'} cho phim “${deleteTarget?.movie_title || ''}” sẽ bị xóa vĩnh viễn và điểm trung bình của phim sẽ được tính lại.`}
        confirmLabel="Xóa bình luận"
        loading={busy}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

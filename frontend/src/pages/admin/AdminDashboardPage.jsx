import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Film,
  MessageSquareQuote,
  RefreshCw,
  Star,
  Users,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../api/client';
import { PosterImage } from '../../components/PosterImage';
import { RatingStars } from '../../components/RatingStars';

function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0);
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [syncData, setSyncData] = useState({ jobs: [], indexes: [] });
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, syncRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminSyncJobs({ limit: 8 }).catch(() => ({ jobs: [], indexes: [] })),
      ]);
      setStats(data);
      setSyncData(syncRes);
    } catch (err) {
      setError(err.message || 'Không thể tải thống kê hệ thống.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse bg-[#16161B]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse border border-[#F3EFE6]/10 bg-[#131317]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-80 animate-pulse border border-[#F3EFE6]/10 bg-[#131317] lg:col-span-5" />
          <div className="h-80 animate-pulse border border-[#F3EFE6]/10 bg-[#131317] lg:col-span-7" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-[#E04848]/40 bg-[#161214] p-6">
        <h2 className="font-editorial text-xl text-[#F3EFE6]">Không thể tải dữ liệu thống kê</h2>
        <p className="mt-2 text-sm text-[#A59F95]">{error}</p>
        <button
          type="button"
          onClick={loadStats}
          className="mt-4 bg-[#D63628] px-4 py-2 text-xs font-medium text-[#F3EFE6]"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const { kpis, rating_distribution, top_genres, top_rated_movies, movies_by_decade, recent_reviews } = stats;
  const maxGenreCount = Math.max(...top_genres.map((g) => g.movie_count), 1);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#F3EFE6]/10 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-[#F3EFE6]">
            Tổng quan hệ thống
          </h1>
          <p className="mt-1 text-sm text-[#A59F95]">
            Số liệu hoạt động kho phim, người dùng và đánh giá cộng đồng.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-[#F3EFE6]/16 px-3.5 py-2 text-xs font-medium text-[#F3EFE6] transition-colors hover:border-[#F3EFE6]/40 hover:bg-[#1B1B21]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Làm mới
        </button>
      </div>

      {/* 4 KPI Cards */}
      <section aria-label="Chỉ số tổng quan" className="grid grid-cols-1 gap-px border border-[#F3EFE6]/10 bg-[#F3EFE6]/10 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-[#131317] p-6">
          <div className="flex items-center justify-between text-[#A59F95]">
            <span className="text-xs font-medium">Phim đang hiển thị</span>
            <Film className="h-4 w-4 text-[#D63628]" aria-hidden="true" />
          </div>
          <p className="font-mono-ledger mt-3 text-3xl font-semibold text-[#F3EFE6]">
            {formatNumber(kpis.total_movies)}
          </p>
          <p className="mt-2 text-xs text-[#746F67]">
            <span className="font-mono-ledger text-[#A59F95]">{formatNumber(kpis.deleted_movies)}</span> phim trong thùng rác
          </p>
        </div>

        <div className="bg-[#131317] p-6">
          <div className="flex items-center justify-between text-[#A59F95]">
            <span className="text-xs font-medium">Người dùng</span>
            <Users className="h-4 w-4 text-[#F3EFE6]/70" aria-hidden="true" />
          </div>
          <p className="font-mono-ledger mt-3 text-3xl font-semibold text-[#F3EFE6]">
            {formatNumber(kpis.total_users)}
          </p>
          <p className="mt-2 text-xs text-[#746F67]">
            <span className="font-mono-ledger text-[#3DA86E]">{formatNumber(kpis.active_users)}</span> hoạt động ·{' '}
            <span className="font-mono-ledger text-[#E04848]">{formatNumber(kpis.total_users - kpis.active_users)}</span> đang khóa
          </p>
        </div>

        <div className="bg-[#131317] p-6">
          <div className="flex items-center justify-between text-[#A59F95]">
            <span className="text-xs font-medium">Điểm đánh giá trung bình</span>
            <Star className="h-4 w-4 fill-[#E0A43B] text-[#E0A43B]" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="font-mono-ledger text-3xl font-semibold text-[#E0A43B]">
              {kpis.global_avg_rating.toFixed(2)}
            </p>
            <span className="font-mono-ledger text-xs text-[#746F67]">/ 5.0</span>
          </div>
          <p className="mt-2 text-xs text-[#746F67]">
            <span className="font-mono-ledger text-[#A59F95]">{formatNumber(kpis.total_reviews)}</span> đánh giá ·{' '}
            <span className="font-mono-ledger text-[#D99B26]">{formatNumber(kpis.hidden_reviews)}</span> đã ẩn
          </p>
        </div>

        <div className="bg-[#131317] p-6">
          <div className="flex items-center justify-between text-[#A59F95]">
            <span className="text-xs font-medium">Lượt tương tác</span>
            <Activity className="h-4 w-4 text-[#A59F95]" aria-hidden="true" />
          </div>
          <p className="font-mono-ledger mt-3 text-3xl font-semibold text-[#F3EFE6]">
            {formatNumber(kpis.total_interactions)}
          </p>
          <p className="mt-2 text-xs text-[#746F67]">
            Lượt xem, yêu thích & lưu danh sách
          </p>
        </div>
      </section>

      {/* Row 2: Rating Distribution + Movies by Decade */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="border border-[#F3EFE6]/10 bg-[#131317] p-6 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#F3EFE6]/10 pb-4">
            <h2 className="font-editorial text-xl font-semibold text-[#F3EFE6]">
              Phân bố điểm đánh giá
            </h2>
            <span className="font-mono-ledger text-xs text-[#E0A43B]">
              TB {kpis.global_avg_rating.toFixed(2)} ★
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {rating_distribution.map((bucket) => {
              const barColor =
                bucket.rating >= 4
                  ? 'bg-[#E0A43B]'
                  : bucket.rating === 3
                    ? 'bg-[#A59F95]'
                    : 'bg-[#D63628]';
              return (
                <div key={bucket.rating} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-mono-ledger text-[#F3EFE6]">
                      <span>{bucket.rating} sao</span>
                      <RatingStars value={bucket.rating} size="sm" />
                    </span>
                    <span className="font-mono-ledger text-[#A59F95]">
                      {formatNumber(bucket.count)}{' '}
                      <span className="text-[#746F67]">({bucket.percentage}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#1D1D24]" role="progressbar" aria-valuenow={bucket.percentage} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className={`h-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.max(bucket.percentage, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border border-[#F3EFE6]/10 bg-[#131317] p-6 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#F3EFE6]/10 pb-4">
            <h2 className="font-editorial text-xl font-semibold text-[#F3EFE6]">
              Số lượng phim theo thập kỷ
            </h2>
            <span className="font-mono-ledger text-xs text-[#746F67]">
              {movies_by_decade.length} giai đoạn
            </span>
          </div>

          <div className="mt-5 h-64 w-full" aria-label="Biểu đồ số lượng phim theo thập kỷ">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movies_by_decade} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(243,239,230,0.06)" vertical={false} />
                <XAxis
                  dataKey="decade"
                  tick={{ fill: '#A59F95', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={{ stroke: 'rgba(243,239,230,0.12)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#746F67', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(243,239,230,0.04)' }}
                  contentStyle={{
                    backgroundColor: '#16161C',
                    border: '1px solid rgba(243,239,230,0.18)',
                    borderRadius: 0,
                    color: '#F3EFE6',
                    fontSize: '12px',
                    fontFamily: 'IBM Plex Mono',
                  }}
                  formatter={(value) => [`${value} phim`, 'Số lượng']}
                />
                <Bar dataKey="count" radius={[1, 1, 0, 0]} maxBarSize={38}>
                  {movies_by_decade.map((entry, idx) => (
                    <Cell
                      key={entry.decade}
                      fill={idx >= movies_by_decade.length - 3 ? '#D63628' : '#E2DDD3'}
                      fillOpacity={idx >= movies_by_decade.length - 3 ? 0.92 : 0.78}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Row 3: Top Rated Movies */}
      <section className="border border-[#F3EFE6]/10 bg-[#131317] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F3EFE6]/10 pb-4">
          <h2 className="font-editorial text-xl font-semibold text-[#F3EFE6]">
            Phim được đánh giá cao
          </h2>
          <Link
            to="/admin/movies"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A59F95] transition-colors hover:text-[#F3EFE6]"
          >
            <span>Quản lý tất cả phim</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {top_rated_movies.map((m) => (
            <div key={m.id} className="group">
              <div className="relative overflow-hidden">
                <PosterImage movieId={m.id} src={m.poster_url} title={m.title} year={m.release_year} size="sm" />
                <div className="absolute right-1.5 top-1.5 border border-[#E0A43B]/30 bg-[#0B0B0D]/90 px-1.5 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#E0A43B]">
                  ★ {m.avg_rating.toFixed(1)}
                </div>
              </div>
              <p className="font-editorial mt-2 line-clamp-1 text-sm font-medium text-[#F3EFE6]" title={m.title}>
                {m.title}
              </p>
              <p className="font-mono-ledger mt-0.5 text-[11px] text-[#746F67]">
                {m.release_year} · {m.rating_count} đánh giá
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Row 4: Top Genres + Recent Reviews */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="border border-[#F3EFE6]/10 bg-[#131317] p-6 lg:col-span-6">
          <div className="border-b border-[#F3EFE6]/10 pb-4">
            <h2 className="font-editorial text-xl font-semibold text-[#F3EFE6]">
              Thống kê theo thể loại
            </h2>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#F3EFE6]/10 text-xs text-[#746F67]">
                  <th className="py-2.5 pr-4 font-medium">Thể loại</th>
                  <th className="py-2.5 pr-4 font-medium">Số phim</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Điểm TB</th>
                  <th className="py-2.5 text-right font-medium">Lượt xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EFE6]/6">
                {top_genres.map((g) => (
                  <tr key={g.genre} className="hover:bg-[#1B1B21]/60">
                    <td className="py-2.5 pr-4 font-medium text-[#F3EFE6]">{g.genre}</td>
                    <td className="w-40 py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 bg-[#1E1E26]">
                          <div
                            className="h-full bg-[#F3EFE6]/80"
                            style={{ width: `${Math.round((g.movie_count / maxGenreCount) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono-ledger w-8 text-right text-xs text-[#A59F95]">
                          {g.movie_count}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono-ledger text-xs text-[#E0A43B]">
                      {g.avg_rating.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right font-mono-ledger text-xs text-[#A59F95]">
                      {formatNumber(g.total_views)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-[#F3EFE6]/10 bg-[#131317] p-6 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-[#F3EFE6]/10 pb-4">
            <h2 className="font-editorial text-xl font-semibold text-[#F3EFE6]">
              Bình luận mới nhất
            </h2>
            <Link
              to="/admin/reviews"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A59F95] hover:text-[#F3EFE6]"
            >
              <span>Kiểm duyệt</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <ul className="mt-4 divide-y divide-[#F3EFE6]/8">
            {recent_reviews.map((rev) => (
              <li key={rev.id} className="py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <MessageSquareQuote className="h-3.5 w-3.5 shrink-0 text-[#746F67]" aria-hidden="true" />
                    <span className="truncate text-sm font-medium text-[#F3EFE6]">{rev.movie_title}</span>
                    {rev.is_hidden && (
                      <span className="border border-[#D99B26]/40 bg-[#D99B26]/10 px-1.5 py-0.5 text-[10px] text-[#D99B26]">
                        Đã ẩn
                      </span>
                    )}
                  </div>
                  <RatingStars value={rev.rating} size="sm" />
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#A59F95]">
                  “{rev.comment || 'Không có nội dung nhận xét.'}”
                </p>
                <p className="mt-1.5 text-[11px] text-[#746F67]">
                  {rev.user_name} · {new Date(rev.created_at).toLocaleDateString('vi-VN')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Collapsible Technical Status (only expanded when needed) */}
      <section className="border border-[#F3EFE6]/10 bg-[#131317]">
        <button
          type="button"
          onClick={() => setShowTechDetails((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left text-xs font-medium text-[#A59F95] transition-colors hover:text-[#F3EFE6]"
        >
          <span>Trạng thái đồng bộ dữ liệu & cấu trúc lưu trữ ({syncData.jobs.length} sự kiện gần nhất)</span>
          {showTechDetails ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {showTechDetails && (
          <div className="grid grid-cols-1 gap-6 border-t border-[#F3EFE6]/10 p-6 lg:grid-cols-12">
            <div className="space-y-2.5 lg:col-span-5">
              <p className="text-xs font-medium text-[#F3EFE6]">Chỉ mục bảng dữ liệu</p>
              {syncData.indexes.map((col) => (
                <div key={col.collection} className="border border-[#F3EFE6]/10 bg-[#0F0F13] p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono-ledger font-medium text-[#F3EFE6]">{col.collection}</span>
                    <span className="font-mono-ledger text-[11px] text-[#3DA86E]">
                      {col.index_count} chỉ mục
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {col.indexes.map((idxName) => (
                      <span
                        key={idxName}
                        className="border border-[#F3EFE6]/10 bg-[#16161C] px-1.5 py-0.5 font-mono-ledger text-[10px] text-[#A59F95]"
                      >
                        {idxName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-7">
              <p className="text-xs font-medium text-[#F3EFE6]">Lịch sử đồng bộ gần nhất</p>
              {syncData.jobs.length === 0 ? (
                <p className="mt-3 text-xs text-[#746F67]">Chưa có thay đổi dữ liệu mới sau khi khởi tạo.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left font-mono-ledger text-xs">
                    <thead>
                      <tr className="border-b border-[#F3EFE6]/10 text-[11px] text-[#746F67]">
                        <th className="py-2 pr-3">Đối tượng</th>
                        <th className="py-2 pr-3">Thao tác</th>
                        <th className="py-2 pr-3">Trạng thái</th>
                        <th className="py-2 text-right">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3EFE6]/6">
                      {syncData.jobs.map((job) => (
                        <tr key={job.id}>
                          <td className="py-2 pr-3 text-[#F3EFE6]">{job.entity_type}</td>
                          <td className="py-2 pr-3 text-[#E0A43B]">{job.action}</td>
                          <td className="py-2 pr-3 text-[#A59F95]">{job.status}</td>
                          <td className="py-2 text-right text-[#746F67]">
                            {new Date(job.created_at).toLocaleTimeString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

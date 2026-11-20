import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  Clapperboard,
  Clock,
  Heart,
  LogOut,
  Play,
  Search,
  ShieldCheck,
  Star,
  User,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';
import { PosterImage } from '../components/PosterImage';
import { RatingStars } from '../components/RatingStars';
import { TrailerModal } from '../components/TrailerModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * Editorial Cinema Browse, Screening Room Trailer Preview, Watchlist & Review Experience (/catalog).
 * Demonstrates MUBI x Criterion x Letterboxd visual direction powered directly by TV1 MongoDB APIs.
 */
export function CatalogPreviewPage() {
  const { user, logout, refreshUser } = useAuth();
  const { pushToast } = useToast();

  const [heroMovie, setHeroMovie] = useState(null);
  const [movies, setMovies] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 48, total: 0, total_pages: 0 });
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeTab, setActiveTab] = useState('catalog'); // catalog | watchlist
  const [watchlistMovies, setWatchlistMovies] = useState([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [sort, setSort] = useState('rating');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);

  // Selected Film Inspection Drawer (Detail + Reviews + Watchlist + Like)
  const [activeMovie, setActiveMovie] = useState(null);
  const [movieReviews, setMovieReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [myExistingReviewId, setMyExistingReviewId] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [likedIds, setLikedIds] = useState({});

  // Trailer Screening Room Modal
  const [trailerMovie, setTrailerMovie] = useState(null);

  // User Profile & Taste Drawer
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileGenres, setProfileGenres] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    api.getGenres().then(setGenres).catch(() => {});
  }, []);

  const loadMovies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listMovies({
        q: q || undefined,
        genre: selectedGenre || undefined,
        sort,
        page,
        limit: pageSize,
      });
      setMovies(res.items);
      setMeta(res.meta);
      if (page === 1 && !q && !selectedGenre && res.items.length > 0) {
        setHeroMovie(res.items[0]);
      }
    } catch (err) {
      pushToast({ title: 'Không thể tải danh mục phim', description: err.message, variant: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [q, selectedGenre, sort, page, pageSize, pushToast]);

  const handleLoadMore = async () => {
    if (loadingMore || meta.page >= meta.total_pages) return;
    const nextPage = meta.page + 1;
    setLoadingMore(true);
    try {
      const res = await api.listMovies({
        q: q || undefined,
        genre: selectedGenre || undefined,
        sort,
        page: nextPage,
        limit: pageSize,
      });
      setMovies((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const appended = (res.items || []).filter((m) => !seen.has(m.id));
        return [...prev, ...appended];
      });
      setMeta(res.meta);
    } catch (err) {
      pushToast({ title: 'Không thể tải thêm phim', description: err.message, variant: 'danger' });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadMovies();
  }, [loadMovies]);

  const loadWatchlist = useCallback(async () => {
    if (!user) return;
    setWatchlistLoading(true);
    try {
      const items = await api.getWatchlist();
      setWatchlistMovies(items || []);
    } catch (err) {
      pushToast({ title: 'Lỗi tải Watchlist', description: err.message, variant: 'danger' });
    } finally {
      setWatchlistLoading(false);
    }
  }, [user, pushToast]);

  useEffect(() => {
    if (activeTab === 'watchlist' && user) {
      loadWatchlist();
    }
  }, [activeTab, user, loadWatchlist]);

  const openTrailer = async (movie, e) => {
    if (e) e.stopPropagation();
    setTrailerMovie(movie);
    if (user) {
      api
        .createInteraction({ movie_id: movie.id, type: 'WATCH', duration_sec: 120 })
        .catch(() => {});
    }
  };

  const openFilmDetail = async (movie) => {
    setActiveMovie(movie);
    setMyRating(5);
    setMyComment('');
    setMyExistingReviewId(null);
    setReviewsError('');
    setReviewsLoading(true);
    try {
      const [freshResult, revResult] = await Promise.allSettled([
        api.getMovie(movie.id, true),
        api.listMovieReviews(movie.id, { limit: 30 }),
      ]);
      if (freshResult.status === 'fulfilled') {
        setActiveMovie(freshResult.value);
      }
      if (revResult.status === 'fulfilled') {
        const list = revResult.value.items || [];
        setMovieReviews(list);
        if (user) {
          const mine = list.find((r) => r.user_id === user.id);
          if (mine) {
            setMyExistingReviewId(mine.id);
            setMyRating(mine.rating);
            setMyComment(mine.comment || '');
          }
        }
      } else {
        setMovieReviews([]);
        setReviewsError('Không thể tải bình luận từ máy chủ. Hãy kiểm tra Backend FastAPI.');
      }
    } finally {
      setReviewsLoading(false);
    }
  };

  const inWatchlist = (movieId) => Boolean(user?.watchlist?.includes(movieId));

  const toggleWatchlist = async (movie, e) => {
    if (e) e.stopPropagation();
    if (!user) {
      pushToast({ title: 'Vui lòng đăng nhập', description: 'Đăng nhập để lưu phim vào danh sách xem sau.', variant: 'info' });
      return;
    }
    try {
      if (inWatchlist(movie.id)) {
        await api.removeWatchlist(movie.id);
        pushToast({ title: 'Đã gỡ khỏi Watchlist', description: movie.title, variant: 'info' });
      } else {
        await api.addWatchlist(movie.id);
        pushToast({ title: 'Đã lưu vào Watchlist', description: movie.title, variant: 'success' });
      }
      await refreshUser();
      if (activeTab === 'watchlist') loadWatchlist();
    } catch (err) {
      pushToast({ title: 'Thao tác Watchlist thất bại', description: err.message, variant: 'danger' });
    }
  };

  const handleLikeMovie = async (movie) => {
    if (!user) {
      pushToast({ title: 'Vui lòng đăng nhập', description: 'Đăng nhập để bày tỏ yêu thích tác phẩm.', variant: 'info' });
      return;
    }
    try {
      await api.createInteraction({ movie_id: movie.id, type: 'LIKE', duration_sec: 0 });
      setLikedIds((prev) => ({ ...prev, [movie.id]: true }));
      pushToast({
        title: 'Đã thêm vào phim yêu thích',
        description: movie.title,
        variant: 'success',
      });
    } catch (err) {
      pushToast({ title: 'Không thể gửi tương tác', description: err.message, variant: 'danger' });
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user || !activeMovie) return;
    setSubmittingReview(true);
    try {
      const saved = await api.upsertReview(activeMovie.id, {
        rating: Number(myRating),
        comment: myComment.trim(),
      });
      setMyExistingReviewId(saved.id);
      pushToast({
        title: myExistingReviewId ? 'Đã cập nhật đánh giá' : 'Đã gửi đánh giá của bạn',
        description: `Chấm ${myRating}/5 sao cho “${activeMovie.title}”.`,
        variant: 'success',
      });
      const [fresh, revRes] = await Promise.all([
        api.getMovie(activeMovie.id, false),
        api.listMovieReviews(activeMovie.id, { limit: 30 }),
      ]);
      setActiveMovie(fresh);
      setMovieReviews(revRes.items || []);
      loadMovies();
    } catch (err) {
      pushToast({ title: 'Không thể gửi đánh giá', description: err.message, variant: 'danger' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteMyReview = async () => {
    if (!myExistingReviewId || !activeMovie) return;
    setSubmittingReview(true);
    try {
      await api.deleteReview(myExistingReviewId);
      setMyExistingReviewId(null);
      setMyRating(5);
      setMyComment('');
      pushToast({ title: 'Đã xóa đánh giá của bạn', variant: 'info' });
      const [fresh, revRes] = await Promise.all([
        api.getMovie(activeMovie.id, false),
        api.listMovieReviews(activeMovie.id, { limit: 30 }),
      ]);
      setActiveMovie(fresh);
      setMovieReviews(revRes.items || []);
      loadMovies();
    } catch (err) {
      pushToast({ title: 'Không thể xóa đánh giá', description: err.message, variant: 'danger' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleOpenProfile = () => {
    if (!user) return;
    setProfileName(user.full_name || '');
    setProfileBio(user.bio || '');
    setProfileGenres(user.favorite_genres || []);
    setProfileOpen(true);
  };

  const toggleProfileGenre = (gName) => {
    setProfileGenres((prev) =>
      prev.includes(gName) ? prev.filter((x) => x !== gName) : [...prev, gName].slice(0, 8)
    );
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.updateProfile({
        full_name: profileName.trim(),
        bio: profileBio.trim() || null,
        favorite_genres: profileGenres,
      });
      await refreshUser();
      setProfileOpen(false);
      pushToast({
        title: 'Đã cập nhật hồ sơ',
        description: 'Thông tin cá nhân và thể loại yêu thích của bạn đã được lưu.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({ title: 'Cập nhật hồ sơ thất bại', description: err.message, variant: 'danger' });
    } finally {
      setSavingProfile(false);
    }
  };

  const displayedMovies = activeTab === 'watchlist' ? watchlistMovies : movies;

  return (
    <div className="cinema-grain min-h-dvh bg-[#0B0B0D] text-[#F3EFE6]">
      {/* Editorial Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-[#F3EFE6]/10 bg-[#0B0B0D]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-6">
            <Link to="/catalog" onClick={() => setActiveTab('catalog')} className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center bg-[#D63628]">
                <Clapperboard className="h-4 w-4 text-[#F3EFE6]" aria-hidden="true" />
              </span>
              <span className="font-editorial text-xl font-bold tracking-tight">CineVault</span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex" aria-label="Chế độ xem">
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className={`px-3 py-1.5 text-xs font-medium tracking-wider uppercase transition-colors ${
                  activeTab === 'catalog'
                    ? 'bg-[#1B1B21] text-[#F3EFE6]'
                    : 'text-[#A59F95] hover:text-[#F3EFE6]'
                }`}
              >
                Kho phim ({meta.total})
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => setActiveTab('watchlist')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium tracking-wider uppercase transition-colors ${
                    activeTab === 'watchlist'
                      ? 'bg-[#1B1B21] text-[#E0A43B]'
                      : 'text-[#A59F95] hover:text-[#F3EFE6]'
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Watchlist ({user.watchlist?.length || 0})</span>
                </button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 border border-[#D63628]/60 bg-[#D63628]/12 px-3 py-1.5 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase transition-colors hover:bg-[#D63628]"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Studio Admin</span>
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenProfile}
                  className="inline-flex items-center gap-1.5 border border-[#F3EFE6]/16 bg-[#131317] px-3 py-1.5 text-xs text-[#F3EFE6] transition-colors hover:border-[#F3EFE6]/45"
                >
                  <User className="h-3.5 w-3.5 text-[#E0A43B]" aria-hidden="true" />
                  <span className="hidden max-w-[140px] truncate sm:inline">{user.full_name}</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Đăng xuất"
                  className="inline-flex items-center gap-1.5 border border-[#F3EFE6]/16 px-3 py-1.5 text-xs text-[#A59F95] hover:border-[#E04848]/50 hover:text-[#F3EFE6]"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Thoát</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-[#D63628] px-4 py-1.5 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase hover:bg-[#E54739]"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Editorial Hero Feature (MUBI Spread) */}
      {activeTab === 'catalog' && heroMovie && !q && !selectedGenre && page === 1 && (
        <section className="relative overflow-hidden border-b border-[#F3EFE6]/10 bg-[#101014]">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-8 px-4 py-12 sm:px-8 lg:grid-cols-12 lg:py-16">
            <div className="space-y-5 lg:col-span-8">
              <div className="flex flex-wrap items-center gap-3 font-mono-ledger text-[11px] tracking-[0.22em] text-[#D63628] uppercase">
                <span>Tác phẩm Tuyển chọn</span>
                <span className="text-[#746F67]">·</span>
                <span className="text-[#A59F95]">{heroMovie.release_year}</span>
                <span className="text-[#746F67]">·</span>
                <span className="text-[#A59F95]">{heroMovie.runtime_minutes} MIN</span>
                {heroMovie.certificate && (
                  <>
                    <span className="text-[#746F67]">·</span>
                    <span className="border border-[#F3EFE6]/20 px-1.5 py-0.5 text-[10px] text-[#F3EFE6]">
                      {heroMovie.certificate}
                    </span>
                  </>
                )}
              </div>

              <h1 className="font-editorial text-4xl font-semibold leading-[1.18] tracking-tight text-[#F3EFE6] sm:text-6xl">
                {heroMovie.title}
              </h1>

              <p className="font-mono-ledger text-xs tracking-wider text-[#A59F95] uppercase">
                Đạo diễn: <span className="text-[#F3EFE6]">{heroMovie.directors?.join(', ') || '—'}</span>
                {heroMovie.cast?.length > 0 && (
                  <>
                    {' '}· Diễn viên: <span className="text-[#D8D3C8]">{heroMovie.cast.slice(0, 3).join(', ')}</span>
                  </>
                )}
              </p>

              <p className="max-w-2xl text-sm leading-relaxed text-[#C9C3B8] sm:text-base">
                {heroMovie.overview}
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => openTrailer(heroMovie)}
                  className="inline-flex items-center gap-2.5 bg-[#D63628] px-6 py-3 text-xs font-semibold tracking-[0.18em] text-[#F3EFE6] uppercase transition-colors hover:bg-[#E54739]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span>Xem Trailer</span>
                </button>
                <button
                  type="button"
                  onClick={() => openFilmDetail(heroMovie)}
                  className="bg-[#F3EFE6] px-6 py-3 text-xs font-semibold tracking-[0.18em] text-[#0B0B0D] uppercase transition-colors hover:bg-white"
                >
                  Chi tiết & Bình luận
                </button>
                <button
                  type="button"
                  onClick={(e) => toggleWatchlist(heroMovie, e)}
                  className="inline-flex items-center gap-2 border border-[#F3EFE6]/25 px-5 py-3 text-xs font-medium tracking-[0.16em] text-[#F3EFE6] uppercase transition-colors hover:border-[#F3EFE6]"
                >
                  {inWatchlist(heroMovie.id) ? (
                    <>
                      <BookmarkCheck className="h-4 w-4 text-[#E0A43B]" aria-hidden="true" />
                      <span>Trong Watchlist</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                      <span>Lưu xem sau</span>
                    </>
                  )}
                </button>
                <div className="flex items-center gap-2 pl-1 font-mono-ledger text-sm text-[#E0A43B]">
                  <Star className="h-4 w-4 fill-[#E0A43B]" aria-hidden="true" />
                  <span className="font-semibold">{heroMovie.avg_rating.toFixed(2)}</span>
                  <span className="text-xs text-[#746F67]">({heroMovie.rating_count} đánh giá)</span>
                </div>
              </div>
            </div>

            <div className="mx-auto w-56 sm:w-64 lg:col-span-4 lg:ml-auto lg:w-72">
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => openFilmDetail(heroMovie)}
                  className="block w-full text-left transition-transform duration-300 group-hover:-translate-y-1"
                >
                  <PosterImage movieId={heroMovie.id} src={heroMovie.poster_url} title={heroMovie.title} year={heroMovie.release_year} />
                </button>
                <button
                  type="button"
                  onClick={() => openTrailer(heroMovie)}
                  aria-label={`Phát trailer ${heroMovie.title}`}
                  className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 border border-[#F3EFE6]/30 bg-[#0B0B0D]/90 px-3 py-1.5 font-mono-ledger text-[11px] font-medium text-[#F3EFE6] uppercase backdrop-blur-sm transition-colors hover:border-[#D63628] hover:bg-[#D63628]"
                >
                  <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                  <span>Trailer</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Catalog Controls & Poster Grid */}
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
        {activeTab === 'watchlist' ? (
          <div className="mb-6 flex items-end justify-between border-b border-[#F3EFE6]/10 pb-5">
            <div>
              <h1 className="font-editorial text-3xl font-semibold text-[#F3EFE6]">
                Danh sách xem sau ({watchlistMovies.length})
              </h1>
              <p className="mt-1 text-sm text-[#A59F95]">
                Những bộ phim bạn đã lưu lại để thưởng thức.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="border border-[#F3EFE6]/18 px-3.5 py-1.5 text-xs tracking-wider text-[#F3EFE6] uppercase hover:border-[#F3EFE6]"
            >
              ← Quay lại toàn bộ kho phim
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col justify-between gap-4 border-b border-[#F3EFE6]/10 pb-6 md:flex-row md:items-center">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746F67]" aria-hidden="true" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm phim, đạo diễn, diễn viên..."
                  aria-label="Tìm kiếm trong kho phim"
                  className="w-full border border-[#F3EFE6]/14 bg-[#131317] py-2.5 pl-10 pr-4 text-sm text-[#F3EFE6] placeholder:text-[#746F67] focus:border-[#F3EFE6]/45 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono-ledger text-xs text-[#746F67]">
                  Đang hiện {movies.length} / {meta.total.toLocaleString('vi-VN')} phim
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label="Số phim mỗi trang"
                  className="border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2 text-xs text-[#F3EFE6]"
                >
                  <option value={24}>24 phim / trang</option>
                  <option value={48}>48 phim / trang</option>
                  <option value={96}>96 phim / trang</option>
                  <option value={150}>150 phim / trang</option>
                </select>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Sắp xếp"
                  className="border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2 text-xs text-[#F3EFE6]"
                >
                  <option value="rating">Điểm cao nhất</option>
                  <option value="newest">Năm mới nhất</option>
                  <option value="views">Xem nhiều nhất</option>
                  <option value="title">Tên A → Z</option>
                </select>
              </div>
            </div>

            {/* Genre Chips Rail */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedGenre('');
                  setPage(1);
                }}
                className={`border px-3 py-1 text-xs transition-colors ${
                  selectedGenre === ''
                    ? 'border-[#D63628] bg-[#D63628] text-[#F3EFE6]'
                    : 'border-[#F3EFE6]/12 text-[#A59F95] hover:border-[#F3EFE6]/35 hover:text-[#F3EFE6]'
                }`}
              >
                Tất cả
              </button>
              {genres.slice(0, 14).map((g) => (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => {
                    setSelectedGenre(g.name);
                    setPage(1);
                  }}
                  className={`border px-3 py-1 text-xs transition-colors ${
                    selectedGenre === g.name
                      ? 'border-[#F3EFE6] bg-[#F3EFE6] font-medium text-[#0B0B0D]'
                      : 'border-[#F3EFE6]/12 text-[#A59F95] hover:border-[#F3EFE6]/35 hover:text-[#F3EFE6]'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Poster Gallery Grid with Editorial Hover Curtain */}
        {(activeTab === 'watchlist' ? watchlistLoading : loading) ? (
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse bg-[#141418]" />
            ))}
          </div>
        ) : displayedMovies.length === 0 ? (
          <div className="mt-8 border border-[#F3EFE6]/10 bg-[#131317] p-12 text-center">
            <p className="font-editorial text-2xl text-[#F3EFE6]">
              {activeTab === 'watchlist'
                ? 'Danh sách xem sau của bạn đang trống'
                : 'Không tìm thấy tác phẩm phù hợp'}
            </p>
            <p className="mt-2 text-sm text-[#A59F95]">
              {activeTab === 'watchlist'
                ? 'Nhấn vào biểu tượng đánh dấu trên bất kỳ bộ phim nào để lưu vào Watchlist.'
                : 'Thử từ khóa khác hoặc xóa bộ lọc thể loại hiện tại.'}
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {displayedMovies.map((m) => (
              <article key={m.id} className="group flex flex-col">
                <div className="relative overflow-hidden border border-transparent transition-colors duration-300 group-hover:border-[#E0A43B]/45">
                  <button
                    type="button"
                    onClick={() => openFilmDetail(m)}
                    className="block w-full text-left"
                  >
                    <PosterImage
                      movieId={m.id}
                      src={m.poster_url}
                      title={m.title}
                      year={m.release_year}
                      className="group-hover:scale-[1.04]"
                    />
                  </button>

                  {/* Gold Rating Badge */}
                  <div className="pointer-events-none absolute right-2 top-2 border border-[#E0A43B]/35 bg-[#0B0B0D]/90 px-1.5 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#E0A43B]">
                    ★ {m.avg_rating.toFixed(1)}
                  </div>

                  {/* Editorial Darkroom Hover Curtain */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/88 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                    <p className="line-clamp-1 font-mono-ledger text-[10px] text-[#A59F95]">
                      {m.directors?.[0] || 'Cinema Archive'} · {m.runtime_minutes}m
                    </p>
                    <div className="pointer-events-auto mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => openTrailer(m, e)}
                        className="inline-flex flex-1 items-center justify-center gap-1 bg-[#D63628] py-1.5 font-mono-ledger text-[10px] font-semibold tracking-wider text-[#F3EFE6] uppercase transition-colors hover:bg-[#E54739]"
                      >
                        <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                        <span>Trailer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openFilmDetail(m)}
                        className="border border-[#F3EFE6]/30 bg-[#131317]/90 px-2.5 py-1.5 font-mono-ledger text-[10px] text-[#F3EFE6] uppercase hover:border-[#F3EFE6]"
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => openFilmDetail(m)}
                      className="text-left"
                    >
                      <h3
                        className="font-editorial line-clamp-1 text-base font-medium text-[#F3EFE6] transition-colors group-hover:text-[#E0A43B]"
                        title={m.title}
                      >
                        {m.title}
                      </h3>
                    </button>
                    <p className="font-mono-ledger mt-0.5 text-[11px] text-[#746F67]">
                      {m.release_year} · {m.genres[0]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleWatchlist(m, e)}
                    aria-label={inWatchlist(m.id) ? `Gỡ ${m.title} khỏi watchlist` : `Lưu ${m.title} vào watchlist`}
                    className="mt-0.5 text-[#746F67] transition-colors hover:text-[#E0A43B]"
                  >
                    {inWatchlist(m.id) ? (
                      <BookmarkCheck className="h-4 w-4 text-[#E0A43B]" aria-hidden="true" />
                    ) : (
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Load More + Pagination */}
        {activeTab === 'catalog' && meta.total_pages > 1 && (
          <div className="mt-10 space-y-5 border-t border-[#F3EFE6]/10 pt-6">
            {meta.page < meta.total_pages && (
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  className="border border-[#F3EFE6]/25 bg-[#131317] px-8 py-3 text-xs font-medium text-[#F3EFE6] transition-colors hover:border-[#D63628] hover:bg-[#D63628] disabled:opacity-50"
                >
                  {loadingMore
                    ? 'Đang tải thêm phim...'
                    : `Xem thêm phim (Đang hiện ${movies.length} / ${meta.total.toLocaleString('vi-VN')})`}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="font-mono-ledger text-xs text-[#746F67]">
                Trang {meta.page} / {meta.total_pages} · Tổng {meta.total.toLocaleString('vi-VN')} phim
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1 border border-[#F3EFE6]/16 px-3 py-1.5 text-xs text-[#F3EFE6] disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Trước
                </button>
                {Array.from({ length: Math.min(meta.total_pages, 7) }, (_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => {
                        setPage(pNum);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`font-mono-ledger border px-2.5 py-1.5 text-xs transition-colors ${
                        page === pNum
                          ? 'border-[#D63628] bg-[#D63628] text-[#F3EFE6]'
                          : 'border-[#F3EFE6]/14 text-[#A59F95] hover:border-[#F3EFE6]/40 hover:text-[#F3EFE6]'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page >= meta.total_pages}
                  onClick={() => {
                    setPage((p) => Math.min(meta.total_pages, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1 border border-[#F3EFE6]/16 px-3 py-1.5 text-xs text-[#F3EFE6] disabled:opacity-40"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Film Detail + Trailer Trigger + Live Review Drawer */}
      {activeMovie && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/80 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={`Chi tiết phim ${activeMovie.title}`}
        >
          <div className="fixed inset-0" onClick={() => setActiveMovie(null)} />
          <div className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-[#F3EFE6]/14 bg-[#101014] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#F3EFE6]/10 pb-5">
              <div>
                <p className="font-mono-ledger text-[10px] tracking-[0.2em] text-[#D63628] uppercase">
                  {activeMovie.release_year} · {activeMovie.runtime_minutes} MIN{' '}
                  {activeMovie.certificate ? `· ${activeMovie.certificate}` : ''}
                </p>
                <h2 className="font-editorial mt-1 text-3xl font-semibold text-[#F3EFE6]">
                  {activeMovie.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveMovie(null)}
                aria-label="Đóng chi tiết phim"
                className="border border-[#F3EFE6]/14 p-2 text-[#A59F95] hover:text-[#F3EFE6]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-12">
              <div className="w-40 sm:col-span-4 sm:w-full">
                <PosterImage movieId={activeMovie.id} src={activeMovie.poster_url} title={activeMovie.title} year={activeMovie.release_year} />
              </div>
              <div className="space-y-4 sm:col-span-8">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 border border-[#E0A43B]/35 bg-[#E0A43B]/10 px-2.5 py-1 font-mono-ledger text-sm font-semibold text-[#E0A43B]">
                    <Star className="h-3.5 w-3.5 fill-[#E0A43B]" aria-hidden="true" />
                    {activeMovie.avg_rating.toFixed(2)} / 5
                  </span>
                  <span className="font-mono-ledger text-xs text-[#746F67]">
                    {activeMovie.rating_count} đánh giá · {activeMovie.views_count.toLocaleString('vi-VN')} lượt xem
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-[#D8D3C8]">{activeMovie.overview}</p>

                <dl className="space-y-1.5 border-t border-[#F3EFE6]/10 pt-3 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-[#746F67]">Đạo diễn</dt>
                    <dd className="text-[#F3EFE6]">{activeMovie.directors?.join(', ') || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-[#746F67]">Diễn viên</dt>
                    <dd className="text-[#A59F95]">{activeMovie.cast?.join(', ') || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-[#746F67]">Thể loại</dt>
                    <dd className="flex flex-wrap gap-1">
                      {activeMovie.genres?.map((g) => (
                        <span key={g} className="border border-[#F3EFE6]/12 px-2 py-0.5 text-[11px] text-[#A59F95]">
                          {g}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>

                {/* Primary Actions: Trailer + Watchlist + Like */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => openTrailer(activeMovie)}
                    className="inline-flex items-center gap-2 bg-[#D63628] px-4 py-2 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase transition-colors hover:bg-[#E54739]"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>Chiếu Trailer</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => toggleWatchlist(activeMovie, e)}
                    className="inline-flex items-center gap-2 border border-[#F3EFE6]/25 px-4 py-2 text-xs font-medium tracking-wider text-[#F3EFE6] uppercase hover:border-[#F3EFE6]"
                  >
                    {inWatchlist(activeMovie.id) ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 text-[#E0A43B]" aria-hidden="true" />
                        <span>Đã lưu Watchlist</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4" aria-hidden="true" />
                        <span>Thêm Watchlist</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLikeMovie(activeMovie)}
                    className={`inline-flex items-center gap-1.5 border px-3.5 py-2 text-xs font-medium tracking-wider uppercase transition-colors ${
                      likedIds[activeMovie.id]
                        ? 'border-[#D63628] bg-[#D63628]/15 text-[#F3EFE6]'
                        : 'border-[#F3EFE6]/18 text-[#A59F95] hover:border-[#D63628]/60 hover:text-[#F3EFE6]'
                    }`}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${likedIds[activeMovie.id] ? 'fill-[#D63628] text-[#D63628]' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{likedIds[activeMovie.id] ? 'Đã thích' : 'Yêu thích'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Review Form */}
            <div className="mt-8 border-t border-[#F3EFE6]/10 pt-6">
              <h3 className="font-editorial text-xl font-semibold text-[#F3EFE6]">Viết đánh giá của bạn</h3>
              {user ? (
                <form onSubmit={handleSubmitReview} className="mt-4 space-y-3 border border-[#F3EFE6]/10 bg-[#141419] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium tracking-wider text-[#A59F95] uppercase">Điểm số (1–5 sao)</span>
                    <div className="flex items-center gap-2">
                      <RatingStars value={myRating} interactive onChange={setMyRating} size="md" />
                      <span className="font-mono-ledger text-xs text-[#E0A43B]">{myRating}/5</span>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={myComment}
                    onChange={(e) => setMyComment(e.target.value)}
                    placeholder="Cảm nhận của bạn về kịch bản, diễn xuất, quay phim..."
                    className="w-full border border-[#F3EFE6]/12 bg-[#0E0E12] px-3 py-2 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/45 focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    {myExistingReviewId ? (
                      <button
                        type="button"
                        disabled={submittingReview}
                        onClick={handleDeleteMyReview}
                        className="border border-[#E04848]/40 px-3 py-2 text-xs text-[#E04848] transition-colors hover:bg-[#E04848]/12 disabled:opacity-50"
                      >
                        Xóa đánh giá của tôi
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="bg-[#D63628] px-4 py-2 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase hover:bg-[#E54739] disabled:opacity-50"
                    >
                      {submittingReview
                        ? 'Đang lưu...'
                        : myExistingReviewId
                          ? 'Cập nhật đánh giá'
                          : 'Gửi đánh giá'}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-2 text-xs text-[#A59F95]">
                  <Link to="/login" className="text-[#F3EFE6] underline">
                    Đăng nhập
                  </Link>{' '}
                  để chấm điểm và chia sẻ bình luận cho tác phẩm này.
                </p>
              )}
            </div>

            {/* Community Reviews */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono-ledger text-xs tracking-[0.18em] text-[#746F67] uppercase">
                  Bình luận cộng đồng ({movieReviews.length})
                </h3>
                <Clock className="h-3.5 w-3.5 text-[#746F67]" aria-hidden="true" />
              </div>
              {reviewsLoading ? (
                <div className="h-20 animate-pulse bg-[#16161B]" />
              ) : reviewsError ? (
                <p className="text-xs text-[#E04848]">{reviewsError}</p>
              ) : movieReviews.length === 0 ? (
                <p className="text-xs text-[#746F67]">Chưa có bình luận công khai nào.</p>
              ) : (
                <ul className="divide-y divide-[#F3EFE6]/8 border-t border-[#F3EFE6]/10">
                  {movieReviews.map((rev) => (
                    <li key={rev.id} className="py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[#F3EFE6]">{rev.user_name || 'Thành viên'}</span>
                        <RatingStars value={rev.rating} size="sm" />
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#A59F95]">{rev.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Profile & Favorite Genres Drawer */}
      {profileOpen && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Hồ sơ cá nhân và gu điện ảnh"
        >
          <div className="fixed inset-0" onClick={() => setProfileOpen(false)} />
          <form
            onSubmit={handleSaveProfile}
            className="relative z-10 w-full max-w-lg border border-[#F3EFE6]/16 bg-[#121216] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-[#F3EFE6]/10 pb-4">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-[#F3EFE6]">
                  Thông tin tài khoản & Gu phim
                </h2>
                <p className="mt-1 text-xs text-[#A59F95]">
                  Chọn các thể loại bạn yêu thích để nhận gợi ý phim phù hợp hơn.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="text-[#A59F95] hover:text-[#F3EFE6]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="prof-name" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                  Họ và tên hiển thị
                </label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  minLength={2}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0D0D10] px-3.5 py-2.5 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/50 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="prof-bio" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                  Giới thiệu ngắn (Bio)
                </label>
                <textarea
                  id="prof-bio"
                  rows={2}
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  placeholder="Chia sẻ trường phái điện ảnh hoặc đạo diễn yêu thích của bạn..."
                  className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0D0D10] px-3.5 py-2 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/50 focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                  Thể loại yêu thích ({profileGenres.length}/8)
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {genres.map((g) => {
                    const active = profileGenres.includes(g.name);
                    return (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => toggleProfileGenre(g.name)}
                        className={`border px-2.5 py-1 text-xs transition-colors ${
                          active
                            ? 'border-[#E0A43B] bg-[#E0A43B]/15 font-medium text-[#E0A43B]'
                            : 'border-[#F3EFE6]/12 text-[#A59F95] hover:border-[#F3EFE6]/35 hover:text-[#F3EFE6]'
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-[#F3EFE6]/10 pt-4">
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="border border-[#F3EFE6]/16 px-4 py-2 text-xs tracking-wider text-[#A59F95] uppercase hover:text-[#F3EFE6]"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-[#D63628] px-5 py-2 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase hover:bg-[#E54739] disabled:opacity-50"
              >
                {savingProfile ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 16:9 Cinema Screening Room Trailer Modal */}
      <TrailerModal
        open={Boolean(trailerMovie)}
        movie={trailerMovie}
        onClose={() => setTrailerMovie(null)}
      />
    </div>
  );
}

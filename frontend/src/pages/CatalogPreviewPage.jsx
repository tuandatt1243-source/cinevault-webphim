import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  Clapperboard,
  Clock,
  Heart,
  Languages,
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
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { PosterImage } from '../components/PosterImage';
import { RatingStars } from '../components/RatingStars';
import { TrailerModal } from '../components/TrailerModal';
import { useAuth } from '../context/AuthContext';
import { useLanguage, useTranslatedOverview } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

export function CatalogPreviewPage() {
  const { user, logout, refreshUser } = useAuth();
  const { t, tGenre, formatRuntime } = useLanguage();
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

  // Selected Film Inspection Drawer
  const [activeMovie, setActiveMovie] = useState(null);
  const [movieReviews, setMovieReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [myExistingReviewId, setMyExistingReviewId] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [likedIds, setLikedIds] = useState({});

  const [trailerMovie, setTrailerMovie] = useState(null);

  // User Profile & Taste Drawer
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileGenres, setProfileGenres] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);

  const heroSynopsis = useTranslatedOverview(heroMovie);
  const activeSynopsis = useTranslatedOverview(activeMovie);

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
      api.createInteraction({ movie_id: movie.id, type: 'WATCH', duration_sec: 120 }).catch(() => {});
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
        setReviewsError('Không thể tải bình luận từ máy chủ.');
      }
    } finally {
      setReviewsLoading(false);
    }
  };

  const inWatchlist = (movieId) => Boolean(user?.watchlist?.includes(movieId));

  const toggleWatchlist = async (movie, e) => {
    if (e) e.stopPropagation();
    if (!user) {
      pushToast({ title: t('signIn'), description: t('loginSub'), variant: 'info' });
      return;
    }
    try {
      if (inWatchlist(movie.id)) {
        await api.removeWatchlist(movie.id);
        pushToast({ title: 'Watchlist', description: `- ${movie.title}`, variant: 'info' });
      } else {
        await api.addWatchlist(movie.id);
        pushToast({ title: t('savedWatchlist'), description: movie.title, variant: 'success' });
      }
      await refreshUser();
      if (activeTab === 'watchlist') loadWatchlist();
    } catch (err) {
      pushToast({ title: 'Lỗi Watchlist', description: err.message, variant: 'danger' });
    }
  };

  const handleLikeMovie = async (movie) => {
    if (!user) {
      pushToast({ title: t('signIn'), description: t('loginSub'), variant: 'info' });
      return;
    }
    try {
      await api.createInteraction({ movie_id: movie.id, type: 'LIKE', duration_sec: 0 });
      setLikedIds((prev) => ({ ...prev, [movie.id]: true }));
      pushToast({ title: t('liked'), description: movie.title, variant: 'success' });
    } catch (err) {
      pushToast({ title: 'Lỗi tương tác', description: err.message, variant: 'danger' });
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
        title: myExistingReviewId ? t('updateReview') : t('submitReview'),
        description: `${myRating}/5 ★ · ${activeMovie.title}`,
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
      pushToast({ title: t('deleteMyReview'), variant: 'info' });
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
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-[#F3EFE6]/10 bg-[#0B0B0D]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-6">
            <Link to="/catalog" onClick={() => setActiveTab('catalog')} className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center bg-[#D63628]">
                <Clapperboard className="h-4 w-4 text-[#F3EFE6]" aria-hidden="true" />
              </span>
              <span className="font-editorial text-xl font-bold tracking-tight">CineVault</span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex" aria-label="Điều hướng">
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className={`px-3 py-1.5 text-xs font-medium tracking-wider uppercase transition-colors ${
                  activeTab === 'catalog'
                    ? 'bg-[#1B1B21] text-[#F3EFE6]'
                    : 'text-[#A59F95] hover:text-[#F3EFE6]'
                }`}
              >
                {t('catalogNav')} ({meta.total})
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
                  <span>
                    {t('watchlistNav')} ({user.watchlist?.length || 0})
                  </span>
                </button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher compact />

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 border border-[#D63628]/60 bg-[#D63628]/12 px-3 py-1.5 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase transition-colors hover:bg-[#D63628]"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('adminPanel')}</span>
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
                  aria-label={t('signOut')}
                  className="inline-flex items-center gap-1.5 border border-[#F3EFE6]/16 px-3 py-1.5 text-xs text-[#A59F95] hover:border-[#E04848]/50 hover:text-[#F3EFE6]"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('signOut')}</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-[#D63628] px-4 py-1.5 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase hover:bg-[#E54739]"
              >
                {t('signIn')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Editorial Hero Feature */}
      {activeTab === 'catalog' && heroMovie && !q && !selectedGenre && page === 1 && (
        <section className="relative overflow-hidden border-b border-[#F3EFE6]/10 bg-[#101014]">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-8 px-4 py-12 sm:px-8 lg:grid-cols-12 lg:py-16">
            <div className="space-y-5 lg:col-span-8">
              <div className="flex flex-wrap items-center gap-3 font-mono-ledger text-[11px] tracking-[0.18em] text-[#D63628] uppercase">
                <span>{t('featured')}</span>
                <span className="text-[#746F67]">·</span>
                <span className="text-[#A59F95]">{heroMovie.release_year}</span>
                <span className="text-[#746F67]">·</span>
                <span className="text-[#A59F95] normal-case">{formatRuntime(heroMovie.runtime_minutes)}</span>
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

              <p className="text-xs tracking-wide text-[#A59F95]">
                <span className="uppercase">{t('director')}:</span>{' '}
                <span className="text-[#F3EFE6]">{heroMovie.directors?.join(', ') || '—'}</span>
                {heroMovie.cast?.length > 0 && (
                  <>
                    {' '}· <span className="uppercase">{t('cast')}:</span>{' '}
                    <span className="text-[#D8D3C8]">{heroMovie.cast.slice(0, 3).join(', ')}</span>
                  </>
                )}
              </p>

              <div className="max-w-2xl">
                <p className="text-sm leading-relaxed text-[#C9C3B8] sm:text-base">
                  {heroSynopsis.text}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  {heroSynopsis.translating && (
                    <span className="text-xs text-[#746F67]">{t('translating')}</span>
                  )}
                  {heroSynopsis.canToggleOriginal && (
                    <button
                      type="button"
                      onClick={heroSynopsis.toggleOriginal}
                      className="inline-flex items-center gap-1 text-xs text-[#A59F95] underline decoration-[#F3EFE6]/25 underline-offset-4 hover:text-[#F3EFE6]"
                    >
                      <Languages className="h-3 w-3" aria-hidden="true" />
                      <span>{heroSynopsis.showOriginal ? t('showTranslated') : t('showOriginal')}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => openTrailer(heroMovie)}
                  className="inline-flex items-center gap-2.5 bg-[#D63628] px-6 py-3 text-xs font-semibold tracking-[0.14em] text-[#F3EFE6] uppercase transition-colors hover:bg-[#E54739]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span>{t('watchTrailer')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openFilmDetail(heroMovie)}
                  className="bg-[#F3EFE6] px-6 py-3 text-xs font-semibold tracking-[0.14em] text-[#0B0B0D] uppercase transition-colors hover:bg-white"
                >
                  {t('detailsReviews')}
                </button>
                <button
                  type="button"
                  onClick={(e) => toggleWatchlist(heroMovie, e)}
                  className="inline-flex items-center gap-2 border border-[#F3EFE6]/25 px-5 py-3 text-xs font-medium tracking-[0.14em] text-[#F3EFE6] uppercase transition-colors hover:border-[#F3EFE6]"
                >
                  {inWatchlist(heroMovie.id) ? (
                    <>
                      <BookmarkCheck className="h-4 w-4 text-[#E0A43B]" aria-hidden="true" />
                      <span>{t('inWatchlist')}</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                      <span>{t('addWatchlist')}</span>
                    </>
                  )}
                </button>
                <div className="flex items-center gap-2 pl-1 font-mono-ledger text-sm text-[#E0A43B]">
                  <Star className="h-4 w-4 fill-[#E0A43B]" aria-hidden="true" />
                  <span className="font-semibold">{heroMovie.avg_rating.toFixed(2)}</span>
                  <span className="text-xs text-[#746F67]">
                    ({heroMovie.rating_count} {t('reviewsCount')})
                  </span>
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
                  aria-label={`${t('watchTrailer')} ${heroMovie.title}`}
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
                {t('watchlistTitle')} ({watchlistMovies.length})
              </h1>
              <p className="mt-1 text-sm text-[#A59F95]">{t('watchlistSub')}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="border border-[#F3EFE6]/18 px-3.5 py-1.5 text-xs text-[#F3EFE6] hover:border-[#F3EFE6]"
            >
              {t('backToCatalog')}
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
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('searchPlaceholder')}
                  className="w-full border border-[#F3EFE6]/14 bg-[#131317] py-2.5 pl-10 pr-4 text-sm text-[#F3EFE6] placeholder:text-[#746F67] focus:border-[#F3EFE6]/45 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono-ledger text-xs text-[#746F67]">
                  {t('showing')} {movies.length} / {meta.total.toLocaleString('vi-VN')} {t('moviesUnit')}
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
                  <option value={24}>24 {t('perPage')}</option>
                  <option value={48}>48 {t('perPage')}</option>
                  <option value={96}>96 {t('perPage')}</option>
                  <option value={150}>150 {t('perPage')}</option>
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
                  <option value="rating">{t('sortRating')}</option>
                  <option value="newest">{t('sortNewest')}</option>
                  <option value="views">{t('sortViews')}</option>
                  <option value="title">{t('sortTitle')}</option>
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
                {t('allGenres')}
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
                  {tGenre(g.name)}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Poster Gallery Grid */}
        {(activeTab === 'watchlist' ? watchlistLoading : loading) ? (
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse bg-[#141418]" />
            ))}
          </div>
        ) : displayedMovies.length === 0 ? (
          <div className="mt-8 border border-[#F3EFE6]/10 bg-[#131317] p-12 text-center">
            <p className="font-editorial text-2xl text-[#F3EFE6]">—</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {displayedMovies.map((m) => (
              <article key={m.id} className="group flex flex-col">
                <div className="relative overflow-hidden border border-transparent transition-colors duration-300 group-hover:border-[#E0A43B]/45">
                  <button type="button" onClick={() => openFilmDetail(m)} className="block w-full text-left">
                    <PosterImage
                      movieId={m.id}
                      src={m.poster_url}
                      title={m.title}
                      year={m.release_year}
                      className="group-hover:scale-[1.04]"
                    />
                  </button>

                  <div className="pointer-events-none absolute right-2 top-2 border border-[#E0A43B]/35 bg-[#0B0B0D]/90 px-1.5 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#E0A43B]">
                    ★ {m.avg_rating.toFixed(1)}
                  </div>

                  {/* Hover Curtain */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/88 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                    <p className="line-clamp-1 font-mono-ledger text-[10px] text-[#A59F95]">
                      {m.directors?.[0] || '—'} · {formatRuntime(m.runtime_minutes)}
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
                        {t('detailsShort')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button type="button" onClick={() => openFilmDetail(m)} className="text-left">
                      <h3
                        className="font-editorial line-clamp-1 text-base font-medium text-[#F3EFE6] transition-colors group-hover:text-[#E0A43B]"
                        title={m.title}
                      >
                        {m.title}
                      </h3>
                    </button>
                    <p className="font-mono-ledger mt-0.5 text-[11px] text-[#746F67]">
                      {m.release_year} · {tGenre(m.genres[0])}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleWatchlist(m, e)}
                    aria-label={m.title}
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
                    ? t('loadingMore')
                    : `${t('loadMore')} (${movies.length} / ${meta.total.toLocaleString('vi-VN')})`}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="font-mono-ledger text-xs text-[#746F67]">
                {t('page')} {meta.page} / {meta.total_pages} · {t('total')} {meta.total.toLocaleString('vi-VN')}{' '}
                {t('moviesUnit')}
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
                  {t('prev')}
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
                  {t('next')}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Film Detail + Translated Overview + Live Review Drawer */}
      {activeMovie && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/80 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={activeMovie.title}
        >
          <div className="fixed inset-0" onClick={() => setActiveMovie(null)} />
          <div className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-[#F3EFE6]/14 bg-[#101014] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#F3EFE6]/10 pb-5">
              <div>
                <p className="font-mono-ledger text-[11px] tracking-[0.16em] text-[#D63628]">
                  {activeMovie.release_year} · {formatRuntime(activeMovie.runtime_minutes)}
                  {activeMovie.certificate ? ` · ${activeMovie.certificate}` : ''}
                </p>
                <h2 className="font-editorial mt-1 text-3xl font-semibold text-[#F3EFE6]">
                  {activeMovie.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveMovie(null)}
                aria-label="Đóng"
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
                    {activeMovie.rating_count} {t('reviewsCount')} · {activeMovie.views_count.toLocaleString('vi-VN')}{' '}
                    {t('viewsCount')}
                  </span>
                </div>

                <div>
                  <p className="text-sm leading-relaxed text-[#D8D3C8]">{activeSynopsis.text}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    {activeSynopsis.translating && (
                      <span className="text-xs text-[#746F67]">{t('translating')}</span>
                    )}
                    {activeSynopsis.canToggleOriginal && (
                      <button
                        type="button"
                        onClick={activeSynopsis.toggleOriginal}
                        className="inline-flex items-center gap-1 text-xs text-[#A59F95] underline decoration-[#F3EFE6]/25 underline-offset-4 hover:text-[#F3EFE6]"
                      >
                        <Languages className="h-3 w-3" aria-hidden="true" />
                        <span>{activeSynopsis.showOriginal ? t('showTranslated') : t('showOriginal')}</span>
                      </button>
                    )}
                  </div>
                </div>

                <dl className="space-y-1.5 border-t border-[#F3EFE6]/10 pt-3 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-[#746F67]">{t('director')}</dt>
                    <dd className="text-[#F3EFE6]">{activeMovie.directors?.join(', ') || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-[#746F67]">{t('cast')}</dt>
                    <dd className="text-[#A59F95]">{activeMovie.cast?.join(', ') || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-[#746F67]">{t('genres')}</dt>
                    <dd className="flex flex-wrap gap-1">
                      {activeMovie.genres?.map((g) => (
                        <span key={g} className="border border-[#F3EFE6]/12 px-2 py-0.5 text-[11px] text-[#A59F95]">
                          {tGenre(g)}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>

                {/* Primary Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => openTrailer(activeMovie)}
                    className="inline-flex items-center gap-2 bg-[#D63628] px-4 py-2 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase transition-colors hover:bg-[#E54739]"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>{t('playTrailer')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => toggleWatchlist(activeMovie, e)}
                    className="inline-flex items-center gap-2 border border-[#F3EFE6]/25 px-4 py-2 text-xs font-medium tracking-wider text-[#F3EFE6] uppercase hover:border-[#F3EFE6]"
                  >
                    {inWatchlist(activeMovie.id) ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 text-[#E0A43B]" aria-hidden="true" />
                        <span>{t('savedWatchlist')}</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4" aria-hidden="true" />
                        <span>{t('addWatchlist')}</span>
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
                    <span>{likedIds[activeMovie.id] ? t('liked') : t('like')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Review Form */}
            <div className="mt-8 border-t border-[#F3EFE6]/10 pt-6">
              <h3 className="font-editorial text-xl font-semibold text-[#F3EFE6]">{t('writeReview')}</h3>
              {user ? (
                <form onSubmit={handleSubmitReview} className="mt-4 space-y-3 border border-[#F3EFE6]/10 bg-[#141419] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#A59F95]">{t('ratingLabel')}</span>
                    <div className="flex items-center gap-2">
                      <RatingStars value={myRating} interactive onChange={setMyRating} size="md" />
                      <span className="font-mono-ledger text-xs text-[#E0A43B]">{myRating}/5</span>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={myComment}
                    onChange={(e) => setMyComment(e.target.value)}
                    placeholder={t('commentPlaceholder')}
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
                        {t('deleteMyReview')}
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
                        ? '...'
                        : myExistingReviewId
                          ? t('updateReview')
                          : t('submitReview')}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-2 text-xs text-[#A59F95]">
                  <Link to="/login" className="text-[#F3EFE6] underline">
                    {t('signIn')}
                  </Link>{' '}
                  {t('loginToReview')}
                </p>
              )}
            </div>

            {/* Community Reviews */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono-ledger text-xs tracking-[0.16em] text-[#746F67] uppercase">
                  {t('communityReviews')} ({movieReviews.length})
                </h3>
                <Clock className="h-3.5 w-3.5 text-[#746F67]" aria-hidden="true" />
              </div>
              {reviewsLoading ? (
                <div className="h-20 animate-pulse bg-[#16161B]" />
              ) : reviewsError ? (
                <p className="text-xs text-[#E04848]">{reviewsError}</p>
              ) : movieReviews.length === 0 ? (
                <p className="text-xs text-[#746F67]">{t('noReviewsYet')}</p>
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

      {/* User Profile & Favorite Genres Modal */}
      {profileOpen && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Hồ sơ cá nhân"
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
                <label htmlFor="prof-name" className="block text-xs font-medium text-[#A59F95]">
                  {t('fullName')}
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
                <label htmlFor="prof-bio" className="block text-xs font-medium text-[#A59F95]">
                  Bio
                </label>
                <textarea
                  id="prof-bio"
                  rows={2}
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0D0D10] px-3.5 py-2 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/50 focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-[#A59F95]">
                  {t('genres')} ({profileGenres.length}/8)
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
                        {tGenre(g.name)}
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
                className="border border-[#F3EFE6]/16 px-4 py-2 text-xs text-[#A59F95] hover:text-[#F3EFE6]"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-[#D63628] px-5 py-2 text-xs font-semibold text-[#F3EFE6] hover:bg-[#E54739] disabled:opacity-50"
              >
                {savingProfile ? '...' : 'Lưu hồ sơ'}
              </button>
            </div>
          </form>
        </div>
      )}

      <TrailerModal
        open={Boolean(trailerMovie)}
        movie={trailerMovie}
        onClose={() => setTrailerMovie(null)}
      />
    </div>
  );
}

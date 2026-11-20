import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Play,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { BillboardHero } from '../components/BillboardHero';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { MovieDetailModal } from '../components/MovieDetailModal';
import { MovieRow } from '../components/MovieRow';
import { PosterImage } from '../components/PosterImage';
import { TrailerModal } from '../components/TrailerModal';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

const HOME_GENRE_ROWS = ['Action', 'Sci-Fi', 'Crime', 'Animation', 'Drama', 'Horror'];

export function CatalogPreviewPage() {
  const { user, logout, refreshUser } = useAuth();
  const { t, tGenre, formatRuntime } = useLanguage();
  const { pushToast } = useToast();

  // Top nav views: home (Netflix rows) | browse (full 1,055 grid) | popular | watchlist
  const [view, setView] = useState('home');
  const [searchOpen, setSearchOpen] = useState(false);

  // Netflix Home rows state
  const [billboardMovies, setBillboardMovies] = useState([]);
  const [billboardIdx, setBillboardIdx] = useState(0);
  const [top10Movies, setTop10Movies] = useState([]);
  const [genreRows, setGenreRows] = useState({});
  const [homeLoading, setHomeLoading] = useState(true);

  // Full Grid / Search / Filter state
  const [movies, setMovies] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 48, total: 0, total_pages: 0 });
  const [genres, setGenres] = useState([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [watchlistMovies, setWatchlistMovies] = useState([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [sort, setSort] = useState('rating');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);

  // Selected Movie Detail Modal
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

  // User Profile Modal
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileGenres, setProfileGenres] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setQ(trimmed);
      setPage(1);
      if (trimmed && view === 'home') {
        setView('browse');
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, view]);

  useEffect(() => {
    api.getGenres().then(setGenres).catch(() => {});
  }, []);

  // Load Netflix Home Billboard + Top 10 + Genre Rows in parallel
  useEffect(() => {
    let cancelled = false;
    setHomeLoading(true);
    Promise.all([
      api.listMovies({ sort: 'views', limit: 10 }),
      ...HOME_GENRE_ROWS.map((g) => api.listMovies({ genre: g, sort: 'views', limit: 15 })),
    ])
      .then(([topViewsRes, ...genreResults]) => {
        if (cancelled) return;
        const topItems = topViewsRes.items || [];
        // Prefer iconic HD movies with crisp 1080p maxresdefault trailers for Billboard
        const heroPool = topItems.slice(1, 7).length >= 5 ? topItems.slice(1, 7) : topItems.slice(0, 6);
        setBillboardMovies(heroPool);
        setTop10Movies(topItems.slice(0, 10));
        setMeta((prev) => ({ ...prev, total: topViewsRes.meta?.total || prev.total }));

        const rowMap = {};
        HOME_GENRE_ROWS.forEach((g, i) => {
          rowMap[g] = genreResults[i]?.items || [];
        });
        setGenreRows(rowMap);
      })
      .catch((err) => {
        if (!cancelled) {
          pushToast({ title: 'Không thể tải danh mục phim', description: err.message, variant: 'danger' });
        }
      })
      .finally(() => {
        if (!cancelled) setHomeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  // Load Watchlist whenever user is logged in (for Home row + Watchlist tab)
  const loadWatchlist = useCallback(async () => {
    if (!user) {
      setWatchlistMovies([]);
      return;
    }
    setWatchlistLoading(true);
    try {
      const items = await api.getWatchlist();
      setWatchlistMovies(items || []);
    } catch {
      // noop
    } finally {
      setWatchlistLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  // Load Full Grid when in browse / popular mode
  const loadGridMovies = useCallback(async () => {
    if (view !== 'browse' && view !== 'popular') return;
    setGridLoading(true);
    try {
      const res = await api.listMovies({
        q: q || undefined,
        genre: selectedGenre || undefined,
        sort: view === 'popular' ? 'newest' : sort,
        page,
        limit: pageSize,
      });
      setMovies(res.items);
      setMeta(res.meta);
    } catch (err) {
      pushToast({ title: 'Không thể tải danh sách phim', description: err.message, variant: 'danger' });
    } finally {
      setGridLoading(false);
    }
  }, [view, q, selectedGenre, sort, page, pageSize, pushToast]);

  useEffect(() => {
    loadGridMovies();
  }, [loadGridMovies]);

  const handleLoadMore = async () => {
    if (loadingMore || meta.page >= meta.total_pages) return;
    const nextPage = meta.page + 1;
    setLoadingMore(true);
    try {
      const res = await api.listMovies({
        q: q || undefined,
        genre: selectedGenre || undefined,
        sort: view === 'popular' ? 'newest' : sort,
        page: nextPage,
        limit: pageSize,
      });
      setMovies((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...(res.items || []).filter((m) => !seen.has(m.id))];
      });
      setMeta(res.meta);
    } catch (err) {
      pushToast({ title: 'Không thể tải thêm phim', description: err.message, variant: 'danger' });
    } finally {
      setLoadingMore(false);
    }
  };

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
      await loadWatchlist();
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
      if (view === 'browse' || view === 'popular') loadGridMovies();
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
      if (view === 'browse' || view === 'popular') loadGridMovies();
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
      pushToast({ title: 'Đã cập nhật hồ sơ', variant: 'success' });
    } catch (err) {
      pushToast({ title: 'Cập nhật hồ sơ thất bại', description: err.message, variant: 'danger' });
    } finally {
      setSavingProfile(false);
    }
  };

  const openGenreInGrid = (genreName) => {
    setSelectedGenre(genreName);
    setQ('');
    setSearchInput('');
    setPage(1);
    setView('browse');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const gridItems = view === 'watchlist' ? watchlistMovies : movies;

  return (
    <div className="min-h-dvh bg-[#0B0B0D] text-[#F3EFE6]">
      {/* Netflix-style Top Navigation Bar (z-40 cleanly above all content) */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0B0B0D]/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          {/* Left: Red Brand + Pill Nav Items */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => {
                setView('home');
                setSelectedGenre('');
                setSearchInput('');
                setQ('');
              }}
              className="flex items-center gap-1.5 text-left"
            >
              <span className="font-editorial text-2xl font-bold tracking-tight text-[#E50914]">
                TITOFILM
              </span>
            </button>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
              {[
                { key: 'home', label: t('homeNav') },
                { key: 'browse', label: `${t('catalogNav')} (${meta.total || 1055})` },
                { key: 'popular', label: t('popularNav') },
                ...(user ? [{ key: 'watchlist', label: `${t('watchlistNav')} (${user.watchlist?.length || 0})` }] : []),
              ].map((item) => {
                const active = view === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setView(item.key);
                      if (item.key !== 'browse') {
                        setSelectedGenre('');
                      }
                      setPage(1);
                    }}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-white/15 text-white'
                        : 'text-[#A59F95] hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: Inline Expandable Search + Language Switcher + Admin + User */}
          <div className="flex items-center gap-2.5">
            {searchOpen ? (
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[#A59F95]" aria-hidden="true" />
                <input
                  type="search"
                  autoFocus
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onBlur={() => {
                    if (!searchInput.trim()) setSearchOpen(false);
                  }}
                  placeholder={t('searchPlaceholder')}
                  className="w-44 rounded-full border border-white/25 bg-black/70 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-[#746F67] focus:w-64 focus:border-white focus:outline-none sm:w-56"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label={t('searchPlaceholder')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#D8D3C8] transition-colors hover:bg-white/10 hover:text-white"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            <LanguageSwitcher compact />

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E50914]/60 bg-[#E50914]/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#E50914]"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('adminPanel')}</span>
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenProfile}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs text-white transition-colors hover:border-white/40"
                >
                  <User className="h-3.5 w-3.5 text-[#E0A43B]" aria-hidden="true" />
                  <span className="hidden max-w-[120px] truncate lg:inline">{user.full_name}</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  aria-label={t('signOut')}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-[#A59F95] transition-colors hover:border-[#E04848]/60 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-[#E50914] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#F40612]"
              >
                {t('signIn')}
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Pill Navigation */}
        <nav
          className="flex items-center gap-1.5 overflow-x-auto border-t border-white/6 px-4 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Điều hướng di động"
        >
          {[
            { key: 'home', label: t('homeNav') },
            { key: 'browse', label: `${t('catalogNav')} (${meta.total || 1055})` },
            { key: 'popular', label: t('popularNav') },
            ...(user ? [{ key: 'watchlist', label: `${t('watchlistNav')} (${user.watchlist?.length || 0})` }] : []),
          ].map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setView(item.key);
                  if (item.key !== 'browse') setSelectedGenre('');
                  setPage(1);
                }}
                className={`shrink-0 rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                  active ? 'bg-white/15 text-white' : 'text-[#A59F95] hover:bg-white/8 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* === MODE 1: NETFLIX HOME VIEW (16:9 HD Billboard + Top 10 + Genre Rows) === */}
      {view === 'home' && (
        <div className="pb-16">
          {homeLoading ? (
            <div className="mx-auto max-w-[1440px] space-y-8 px-4 pt-6 sm:px-8">
              <div className="h-[56vh] animate-pulse rounded-2xl bg-[#16161C]" />
              <div className="h-56 animate-pulse rounded-xl bg-[#141418]" />
            </div>
          ) : (
            <>
              <BillboardHero
                movies={billboardMovies}
                activeIndex={billboardIdx}
                onSelectIndex={setBillboardIdx}
                pausedExternal={Boolean(activeMovie) || Boolean(trailerMovie)}
                inWatchlist={inWatchlist}
                onPlayTrailer={openTrailer}
                onOpenDetail={openFilmDetail}
                onToggleWatchlist={toggleWatchlist}
              />

              <main className="mx-auto mt-10 max-w-[1440px] space-y-10 px-4 sm:px-8">
                {/* Ranked Top 10 Row */}
                <MovieRow
                  title={t('top10Today')}
                  movies={top10Movies}
                  ranked
                  onSeeAll={() => openGenreInGrid('')}
                  inWatchlist={inWatchlist}
                  onPlayTrailer={openTrailer}
                  onOpenDetail={openFilmDetail}
                  onToggleWatchlist={toggleWatchlist}
                />

                {/* Personal Watchlist Row (when signed in and non-empty) */}
                {user && watchlistMovies.length > 0 && (
                  <MovieRow
                    title={t('watchlistTitle')}
                    movies={watchlistMovies}
                    onSeeAll={() => setView('watchlist')}
                    inWatchlist={inWatchlist}
                    onPlayTrailer={openTrailer}
                    onOpenDetail={openFilmDetail}
                    onToggleWatchlist={toggleWatchlist}
                  />
                )}

                {/* Genre Swimlanes (Plug-in ready: TV2 Neo4j & TV3 Redis rows drop right here) */}
                {HOME_GENRE_ROWS.map((gName) => (
                  <MovieRow
                    key={gName}
                    title={tGenre(gName)}
                    movies={genreRows[gName] || []}
                    onSeeAll={() => openGenreInGrid(gName)}
                    inWatchlist={inWatchlist}
                    onPlayTrailer={openTrailer}
                    onOpenDetail={openFilmDetail}
                    onToggleWatchlist={toggleWatchlist}
                  />
                ))}

                {/* Full Catalog CTA */}
                <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#131318] p-8 text-center sm:flex-row sm:text-left">
                  <div>
                    <h2 className="font-editorial text-2xl font-semibold text-white">
                      {t('exploreAllPrefix')} {(meta.total || 1055).toLocaleString('vi-VN')} {t('moviesUnit')}
                    </h2>
                    <p className="mt-1 text-sm text-[#A59F95]">{t('exploreAllSub')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openGenreInGrid('')}
                    className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#0B0B0D] transition-transform hover:scale-[1.02] hover:bg-white/90"
                  >
                    {t('openFullCatalog')}
                  </button>
                </div>
              </main>
            </>
          )}
        </div>
      )}

      {/* === MODE 2: FULL CATALOG / POPULAR / WATCHLIST GRID === */}
      {view !== 'home' && (
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
          {view === 'watchlist' ? (
            <div className="mb-6 flex items-end justify-between border-b border-white/10 pb-5">
              <div>
                <h1 className="font-editorial text-3xl font-semibold text-white">
                  {t('watchlistTitle')} ({watchlistMovies.length})
                </h1>
                <p className="mt-1 text-sm text-[#A59F95]">{t('watchlistSub')}</p>
              </div>
              <button
                type="button"
                onClick={() => setView('home')}
                className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-white hover:border-white"
              >
                {t('backToCatalog')}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center">
                <div className="relative max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746F67]" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    aria-label={t('searchPlaceholder')}
                    className="w-full rounded-full border border-white/14 bg-[#141419] py-2.5 pl-10 pr-4 text-sm text-[#F3EFE6] placeholder:text-[#746F67] focus:border-white/45 focus:outline-none"
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
                    className="rounded-full border border-white/14 bg-[#141419] px-3.5 py-2 text-xs text-[#F3EFE6]"
                  >
                    <option value={24}>24 {t('perPage')}</option>
                    <option value={48}>48 {t('perPage')}</option>
                    <option value={96}>96 {t('perPage')}</option>
                    <option value={150}>150 {t('perPage')}</option>
                  </select>
                  {view === 'browse' && (
                    <select
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value);
                        setPage(1);
                      }}
                      aria-label="Sắp xếp"
                      className="rounded-full border border-white/14 bg-[#141419] px-3.5 py-2 text-xs text-[#F3EFE6]"
                    >
                      <option value="rating">{t('sortRating')}</option>
                      <option value="views">{t('sortViews')}</option>
                      <option value="newest">{t('sortNewest')}</option>
                      <option value="title">{t('sortTitle')}</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Genre Chips */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGenre('');
                    setPage(1);
                  }}
                  className={`rounded-full border px-3.5 py-1 text-xs transition-colors ${
                    selectedGenre === ''
                      ? 'border-[#E50914] bg-[#E50914] text-white'
                      : 'border-white/12 text-[#A59F95] hover:border-white/35 hover:text-white'
                  }`}
                >
                  {t('allGenres')}
                </button>
                {genres.slice(0, 16).map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => {
                      setSelectedGenre(g.name);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3.5 py-1 text-xs transition-colors ${
                      selectedGenre === g.name
                        ? 'border-white bg-white font-medium text-[#0B0B0D]'
                        : 'border-white/12 text-[#A59F95] hover:border-white/35 hover:text-white'
                    }`}
                  >
                    {tGenre(g.name)}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Poster Grid */}
          {(view === 'watchlist' ? watchlistLoading : gridLoading) ? (
            <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-[#141418]" />
              ))}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {gridItems.map((m) => (
                <article key={m.id} className="group flex flex-col">
                  <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#141418] transition-all duration-300 group-hover:scale-[1.03] group-hover:border-white/35">
                    <button type="button" onClick={() => openFilmDetail(m)} className="block w-full text-left">
                      <PosterImage
                        movieId={m.id}
                        src={m.poster_url}
                        title={m.title}
                        year={m.release_year}
                        className="border-0"
                      />
                    </button>

                    <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/80 px-1.5 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#E0A43B]">
                      ★ {m.avg_rating.toFixed(1)}
                    </div>

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                      <p className="line-clamp-1 font-mono-ledger text-[10px] text-white/75">
                        {m.directors?.[0] || '—'} · {formatRuntime(m.runtime_minutes)}
                      </p>
                      <div className="pointer-events-auto mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => openTrailer(m, e)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-white py-1.5 text-[11px] font-semibold text-[#0B0B0D] hover:bg-white/90"
                        >
                          <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                          <span>Trailer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openFilmDetail(m)}
                          className="rounded-full border border-white/35 bg-black/70 px-3 py-1.5 text-[11px] text-white hover:border-white"
                        >
                          {t('detailsShort')}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button type="button" onClick={() => openFilmDetail(m)} className="text-left">
                        <h3 className="font-editorial line-clamp-1 text-base font-medium text-[#F3EFE6] group-hover:text-white" title={m.title}>
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
                      className="mt-0.5 text-[#746F67] hover:text-[#E0A43B]"
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

          {/* Load More + Numbered Pagination */}
          {view !== 'watchlist' && meta.total_pages > 1 && (
            <div className="mt-10 space-y-5 border-t border-white/10 pt-6">
              {meta.page < meta.total_pages && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={handleLoadMore}
                    className="rounded-full border border-white/25 bg-[#141419] px-8 py-3 text-xs font-semibold text-white transition-colors hover:border-[#E50914] hover:bg-[#E50914] disabled:opacity-50"
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
                    className="inline-flex items-center gap-1 rounded-full border border-white/16 px-3.5 py-1.5 text-xs text-white disabled:opacity-40"
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
                        className={`font-mono-ledger rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          page === pNum
                            ? 'border-[#E50914] bg-[#E50914] text-white'
                            : 'border-white/14 text-[#A59F95] hover:border-white/40 hover:text-white'
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
                    className="inline-flex items-center gap-1 rounded-full border border-white/16 px-3.5 py-1.5 text-xs text-white disabled:opacity-40"
                  >
                    {t('next')}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Netflix-style Center Movie Detail Modal */}
      <MovieDetailModal
        movie={activeMovie}
        user={user}
        inWatchlist={activeMovie ? inWatchlist(activeMovie.id) : false}
        liked={activeMovie ? Boolean(likedIds[activeMovie.id]) : false}
        reviews={movieReviews}
        reviewsLoading={reviewsLoading}
        reviewsError={reviewsError}
        myRating={myRating}
        onChangeRating={setMyRating}
        myComment={myComment}
        onChangeComment={setMyComment}
        myExistingReviewId={myExistingReviewId}
        submittingReview={submittingReview}
        onSubmitReview={handleSubmitReview}
        onDeleteMyReview={handleDeleteMyReview}
        onPlayFullTrailer={(m) => openTrailer(m)}
        onToggleWatchlist={toggleWatchlist}
        onLikeMovie={handleLikeMovie}
        onClose={() => setActiveMovie(null)}
        pausedExternal={Boolean(trailerMovie)}
      />

      {/* User Profile Modal */}
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
            className="relative z-10 w-full max-w-lg rounded-2xl border border-white/16 bg-[#141418] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-white">
                  Thông tin tài khoản & Gu phim
                </h2>
                <p className="mt-1 text-xs text-[#A59F95]">
                  Chọn các thể loại bạn yêu thích để nhận gợi ý phim phù hợp hơn.
                </p>
              </div>
              <button type="button" onClick={() => setProfileOpen(false)} className="text-[#A59F95] hover:text-white">
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
                  className="mt-1.5 w-full rounded-lg border border-white/14 bg-[#0D0D10] px-3.5 py-2.5 text-sm text-white focus:border-white/50 focus:outline-none"
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
                  className="mt-1.5 w-full rounded-lg border border-white/14 bg-[#0D0D10] px-3.5 py-2 text-sm text-white focus:border-white/50 focus:outline-none"
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
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          active
                            ? 'border-[#E0A43B] bg-[#E0A43B]/15 font-medium text-[#E0A43B]'
                            : 'border-white/12 text-[#A59F95] hover:border-white/35 hover:text-white'
                        }`}
                      >
                        {tGenre(g.name)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-full border border-white/16 px-4 py-2 text-xs text-[#A59F95] hover:text-white"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-full bg-[#E50914] px-5 py-2 text-xs font-semibold text-white hover:bg-[#F40612] disabled:opacity-50"
              >
                {savingProfile ? '...' : 'Lưu hồ sơ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fullscreen HD Trailer Modal */}
      <TrailerModal
        open={Boolean(trailerMovie)}
        movie={trailerMovie}
        onClose={() => setTrailerMovie(null)}
      />
    </div>
  );
}

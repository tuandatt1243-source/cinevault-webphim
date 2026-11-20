import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Heart,
  Info,
  Pause,
  Play,
  Shuffle,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { api } from '../api/client';
import { useLanguage, useTranslatedOverview } from '../context/LanguageContext';
import { extractYouTubeId } from './TrailerModal';
import { YouTubeBackdropPlayer } from './YouTubeBackdropPlayer';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Titofilm Reels — Fullscreen Vertical HD Trailer Sampling Feed (Netflix 2026 Clips inspired).
 * Navigate effortlessly via Mouse Wheel, Arrow Up/Down keys, Space (pause), or M (mute).
 */
export function ReelsView({
  initialMovies = [],
  user,
  pausedExternal = false,
  inWatchlist,
  likedIds = {},
  onPlayFullTrailer,
  onOpenDetail,
  onToggleWatchlist,
  onLikeMovie,
  onOpenPerson,
}) {
  const { t, tGenre, formatRuntime } = useLanguage();
  const [reelMovies, setReelMovies] = useState([]);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const wheelLockRef = useRef(0);
  const trackedRef = useRef(new Set());

  const loadShuffledBatch = useCallback(async () => {
    setShuffling(true);
    try {
      const fresh = await api.getRoulette({ limit: 20 });
      if (fresh && fresh.length > 0) {
        setReelMovies(fresh);
        setIndex(0);
      }
    } catch {
      // keep existing batch
    } finally {
      setShuffling(false);
    }
  }, []);

  useEffect(() => {
    const withTrailers = (initialMovies || []).filter((m) => extractYouTubeId(m.trailer_url));
    if (withTrailers.length >= 6) {
      setReelMovies(withTrailers);
      setIndex(0);
    } else {
      loadShuffledBatch();
    }
  }, [initialMovies, loadShuffledBatch]);

  const currentMovie = reelMovies[index] || null;
  const synopsis = useTranslatedOverview(currentMovie);

  const goNext = useCallback(() => {
    setIndex((prev) => (reelMovies.length ? (prev + 1) % reelMovies.length : 0));
    setPaused(false);
  }, [reelMovies.length]);

  const goPrev = useCallback(() => {
    setIndex((prev) => (reelMovies.length ? (prev - 1 + reelMovies.length) % reelMovies.length : 0));
    setPaused(false);
  }, [reelMovies.length]);

  // Keyboard navigation (ArrowUp / ArrowDown / Space / M)
  useEffect(() => {
    const handleKey = (e) => {
      if (pausedExternal) return;
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        goPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === 'm') {
        setMuted((m) => !m);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, pausedExternal]);

  // Record WATCH interaction once per reel movie per session
  useEffect(() => {
    if (!user || !currentMovie || trackedRef.current.has(currentMovie.id)) return;
    const timer = window.setTimeout(() => {
      trackedRef.current.add(currentMovie.id);
      api.createInteraction({ movie_id: currentMovie.id, type: 'WATCH', duration_sec: 30 }).catch(() => {});
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [user, currentMovie]);

  const handleWheel = (e) => {
    if (pausedExternal) return;
    const now = Date.now();
    if (now - wheelLockRef.current < 550) return;
    if (Math.abs(e.deltaY) < 28) return;
    wheelLockRef.current = now;
    if (e.deltaY > 0) goNext();
    else goPrev();
  };

  if (!currentMovie) {
    return (
      <div className="flex h-[calc(100dvh-72px)] items-center justify-center bg-[#08080B]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-[#E50914]" />
      </div>
    );
  }

  const videoId = extractYouTubeId(currentMovie.trailer_url);
  const saved = inWatchlist(currentMovie.id);
  const liked = Boolean(likedIds[currentMovie.id]);

  return (
    <section
      onWheel={handleWheel}
      className="relative h-[calc(100dvh-64px)] w-full overflow-hidden bg-[#060608] select-none"
      aria-label="Titofilm Reels HD"
    >
      {/* Fullscreen HD Trailer Player */}
      <YouTubeBackdropPlayer
        videoId={videoId}
        posterFallback={`${API_BASE}/movies/${currentMovie.id}/poster`}
        title={currentMovie.title}
        muted={muted}
        paused={paused || pausedExternal}
        startSeconds={16}
      />

      {/* Cinematic Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,6,8,0.5) 0%, rgba(6,6,8,0.08) 38%, rgba(6,6,8,0.92) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, rgba(6,6,8,0.82) 0%, rgba(6,6,8,0.22) 55%, rgba(6,6,8,0.5) 100%)',
        }}
      />

      {/* Top Left Reels Indicator + Keyboard Hint */}
      <div className="absolute left-5 top-5 z-20 flex items-center gap-3 sm:left-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#E50914]" />
          <span>TITOFILM REELS · HD</span>
        </span>
        <span className="hidden rounded-full border border-white/10 bg-black/45 px-3 py-1.5 font-mono-ledger text-[11px] text-white/70 backdrop-blur-md sm:inline-block">
          {String(index + 1).padStart(2, '0')} / {String(reelMovies.length).padStart(2, '0')} · {t('reelsHint')}
        </span>
      </div>

      {/* Right Floating Action Column */}
      <div className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-3 sm:right-8">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Trailer trước"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md transition-transform hover:scale-105 hover:border-white"
        >
          <ChevronUp className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onLikeMovie(currentMovie)}
          aria-label={liked ? t('liked') : t('like')}
          className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition-transform hover:scale-105 ${
            liked
              ? 'border-[#E50914] bg-[#E50914]/25 text-[#E50914]'
              : 'border-white/25 bg-black/55 text-white hover:border-white'
          }`}
        >
          <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={(e) => onToggleWatchlist(currentMovie, e)}
          aria-label={saved ? t('inWatchlist') : t('addWatchlist')}
          className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition-transform hover:scale-105 ${
            saved
              ? 'border-[#E0A43B] bg-[#E0A43B]/25 text-[#E0A43B]'
              : 'border-white/25 bg-black/55 text-white hover:border-white'
          }`}
        >
          {saved ? <BookmarkCheck className="h-5 w-5" aria-hidden="true" /> : <Bookmark className="h-5 w-5" aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={() => onOpenDetail(currentMovie)}
          aria-label={t('detailsReviews')}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-md transition-transform hover:scale-105 hover:border-white"
        >
          <Info className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Phát tiếp' : 'Tạm dừng'}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-md transition-transform hover:scale-105 hover:border-white"
        >
          {paused ? <Play className="h-5 w-5 fill-current" aria-hidden="true" /> : <Pause className="h-5 w-5" aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-md transition-transform hover:scale-105 hover:border-white"
        >
          {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
        </button>

        <button
          type="button"
          disabled={shuffling}
          onClick={loadShuffledBatch}
          aria-label="Xáo trộn danh sách Reels"
          title="Xáo trộn danh sách Reels mới"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-md transition-transform hover:scale-105 hover:border-[#E50914] disabled:opacity-50"
        >
          <Shuffle className={`h-4 w-4 ${shuffling ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={goNext}
          aria-label="Trailer tiếp theo"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md transition-transform hover:scale-105 hover:border-white"
        >
          <ChevronDown className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Bottom Left Film Dossier Overlay */}
      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-[1440px] px-5 pb-8 pr-20 sm:px-8 sm:pb-10">
        <div className="max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#E5E0D8]">
            <span className="inline-flex items-center gap-1 font-mono-ledger font-semibold text-[#E0A43B]">
              <Star className="h-3.5 w-3.5 fill-[#E0A43B]" aria-hidden="true" />
              {currentMovie.avg_rating.toFixed(1)}
            </span>
            {currentMovie.imdb_rating && (
              <span className="rounded bg-[#E0A43B]/20 px-1.5 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#E0A43B]">
                IMDb {currentMovie.imdb_rating.toFixed(1)}
              </span>
            )}
            <span className="font-mono-ledger">{currentMovie.release_year}</span>
            <span>·</span>
            <span>{formatRuntime(currentMovie.runtime_minutes)}</span>
            {currentMovie.genres?.slice(0, 3).map((g) => (
              <span key={g} className="rounded-full bg-white/12 px-2.5 py-0.5 text-[11px] backdrop-blur-sm">
                {tGenre(g)}
              </span>
            ))}
          </div>

          <h1 className="font-editorial text-3xl font-bold leading-tight text-white drop-shadow-lg sm:text-5xl">
            {currentMovie.title}
          </h1>

          {currentMovie.directors?.length > 0 && (
            <p className="text-xs text-white/75">
              {t('director')}:{' '}
              {currentMovie.directors.map((d, i) => (
                <span key={d}>
                  {i > 0 && ', '}
                  <button
                    type="button"
                    onClick={() => onOpenPerson?.(d, 'director')}
                    className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                  >
                    {d}
                  </button>
                </span>
              ))}
            </p>
          )}

          <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-[#E2DDD4]/95 sm:line-clamp-3">
            {synopsis.text}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onPlayFullTrailer(currentMovie)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-[#0B0B0D] transition-transform hover:scale-[1.02]"
            >
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              <span>{t('watchTrailer')}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenDetail(currentMovie)}
              className="inline-flex items-center gap-2 rounded-full bg-white/18 px-5 py-2.5 text-xs font-medium text-white backdrop-blur-md hover:bg-white/28"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('detailsReviews')}</span>
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/45 px-4 py-2.5 text-xs text-white/90 backdrop-blur-md hover:border-white"
            >
              <span>{t('reelsNext')}</span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

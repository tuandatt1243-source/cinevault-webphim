import { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Info,
  Languages,
  Pause,
  Play,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useLanguage, useTranslatedOverview } from '../context/LanguageContext';
import { extractYouTubeId } from './TrailerModal';
import { YouTubeBackdropPlayer } from './YouTubeBackdropPlayer';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Netflix-inspired 16:9 Rounded Cinema Billboard Hero with auto-playing HD Trailer backdrop,
 * instant mute/unmute & pause controls, translated synopsis, and slide controls.
 */
export function BillboardHero({
  movies = [],
  activeIndex = 0,
  onSelectIndex,
  pausedExternal = false,
  inWatchlist,
  onPlayTrailer,
  onOpenDetail,
  onToggleWatchlist,
}) {
  const { t, tGenre, formatRuntime } = useLanguage();
  const [muted, setMuted] = useState(true);
  const [userPaused, setUserPaused] = useState(false);

  const movie = movies[activeIndex] || movies[0] || null;
  const synopsis = useTranslatedOverview(movie);

  if (!movie) return null;

  const videoId = extractYouTubeId(movie.trailer_url);
  const fallbackPoster = `${API_BASE}/movies/${movie.id}/poster`;

  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-8">
      <div className="relative min-h-[460px] h-[62vh] max-h-[640px] w-full overflow-hidden rounded-2xl border border-[#F3EFE6]/12 bg-[#0E0E12] shadow-[0_30px_80px_rgba(0,0,0,0.75)]">
        {/* Auto-playing HD 1080p Trailer Backdrop */}
        <YouTubeBackdropPlayer
          videoId={videoId}
          posterFallback={fallbackPoster}
          title={movie.title}
          muted={muted}
          paused={pausedExternal || userPaused}
        />

        {/* Cinema Vignette Gradients (left + bottom) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,10,13,0.92) 0%, rgba(10,10,13,0.62) 45%, rgba(10,10,13,0.18) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,10,13,0.35) 0%, rgba(10,10,13,0.08) 40%, rgba(10,10,13,0.95) 100%)',
          }}
        />

        {/* Top-Left Brand Mark */}
        <div className="absolute left-6 top-6 z-10 flex items-center gap-2 sm:left-10 sm:top-8">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-[#E50914] font-editorial text-lg font-bold text-white shadow-lg">
            T
          </span>
          <span className="font-mono-ledger text-[11px] font-semibold tracking-[0.26em] text-[#F3EFE6]/85 uppercase">
            {t('featuredShort')}
          </span>
        </div>

        {/* Top-Right Video Controls (Mute/Unmute & Play/Pause) */}
        {videoId && (
          <div className="absolute right-5 top-5 z-10 flex items-center gap-2 sm:right-8 sm:top-7">
            <button
              type="button"
              onClick={() => setUserPaused((v) => !v)}
              aria-label={userPaused ? 'Tiếp tục phát nền' : 'Tạm dừng phát nền'}
              title={userPaused ? 'Phát video nền' : 'Tạm dừng video nền'}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition-colors hover:border-white hover:bg-black/75"
            >
              {userPaused ? (
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? 'Bật tiếng trailer' : 'Tắt tiếng trailer'}
              title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition-colors hover:border-white hover:bg-black/75"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        )}

        {/* Bottom Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-between gap-6 p-6 sm:p-10 lg:flex-row lg:items-end">
          {/* Left: Title + Metadata + Synopsis + Pill CTAs */}
          <div className="max-w-2xl space-y-3.5">
            <h1 className="font-editorial text-4xl font-bold leading-[1.12] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] sm:text-5xl lg:text-6xl">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#E5E0D8] sm:text-sm">
              <span className="inline-flex items-center gap-1 font-mono-ledger font-semibold text-[#E0A43B]">
                <Star className="h-3.5 w-3.5 fill-[#E0A43B]" aria-hidden="true" />
                {movie.avg_rating.toFixed(1)}
              </span>
              <span className="text-white/40">•</span>
              <span>{movie.genres?.slice(0, 2).map(tGenre).join(' / ')}</span>
              <span className="text-white/40">•</span>
              <span className="font-mono-ledger">{movie.release_year}</span>
              <span className="text-white/40">•</span>
              <span>{formatRuntime(movie.runtime_minutes)}</span>
              {movie.certificate && (
                <>
                  <span className="text-white/40">•</span>
                  <span className="rounded border border-white/30 bg-black/40 px-1.5 py-0.5 font-mono-ledger text-[11px] text-white">
                    {movie.certificate}
                  </span>
                </>
              )}
            </div>

            <div>
              <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-[#E2DDD4]/95 drop-shadow sm:line-clamp-3">
                {synopsis.text}
              </p>
              {synopsis.canToggleOriginal && (
                <button
                  type="button"
                  onClick={synopsis.toggleOriginal}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/65 hover:text-white"
                >
                  <Languages className="h-3 w-3" aria-hidden="true" />
                  <span>{synopsis.showOriginal ? t('showTranslated') : t('showOriginal')}</span>
                </button>
              )}
            </div>

            {/* Netflix-style Pill Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onPlayTrailer(movie)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#0B0B0D] shadow-lg transition-transform duration-150 hover:scale-[1.02] hover:bg-white/90"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                <span>{t('watchTrailer')}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenDetail(movie)}
                className="inline-flex items-center gap-2 rounded-full bg-white/20 px-6 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/30"
              >
                <Info className="h-4 w-4" aria-hidden="true" />
                <span>{t('detailsReviews')}</span>
              </button>

              <button
                type="button"
                onClick={(e) => onToggleWatchlist(movie, e)}
                aria-label={inWatchlist(movie.id) ? t('inWatchlist') : t('addWatchlist')}
                title={inWatchlist(movie.id) ? t('inWatchlist') : t('addWatchlist')}
                className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors ${
                  inWatchlist(movie.id)
                    ? 'border-[#E0A43B] bg-[#E0A43B]/20 text-[#E0A43B]'
                    : 'border-white/35 bg-black/40 text-white hover:border-white hover:bg-white/15'
                }`}
              >
                {inWatchlist(movie.id) ? (
                  <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Right: Ranking Badge + Slide Switcher Dots */}
          <div className="flex flex-row items-center justify-between gap-4 lg:flex-col lg:items-end">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                <span className="rounded bg-[#E50914] px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold">
                  TOP 10
                </span>
                <span>#{activeIndex + 1} Titofilm</span>
              </span>
            </div>

            {movies.length > 1 && (
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Chuyển phim nổi bật">
                {movies.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === activeIndex}
                    aria-label={item.title}
                    onClick={() => onSelectIndex(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === activeIndex ? 'w-7 bg-white' : 'w-2 bg-white/35 hover:bg-white/65'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

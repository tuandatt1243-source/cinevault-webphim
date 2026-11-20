import { useEffect } from 'react';
import { ExternalLink, Film, Play, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const regExp = /(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

export function TrailerModal({ open, movie, onClose }) {
  const { t, tGenre, formatRuntime } = useLanguage();

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open || !movie) return null;

  const videoId = extractYouTubeId(movie.trailer_url);
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${movie.title} ${movie.release_year || ''} official trailer`
  )}`;
  const directWatchUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : movie.trailer_url || youtubeSearchUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Trailer ${movie.title}`}
    >
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl border border-[#F3EFE6]/18 bg-[#0C0C0F] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3EFE6]/12 bg-[#121217] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center bg-[#D63628] text-[#F3EFE6]">
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            </span>
            <h2 className="font-editorial text-lg font-semibold text-[#F3EFE6]">
              Trailer: {movie.title}{' '}
              {movie.release_year && (
                <span className="font-mono-ledger text-xs font-normal text-[#A59F95]">
                  ({movie.release_year})
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={directWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-[#F3EFE6]/16 px-3 py-1.5 text-xs text-[#A59F95] transition-colors hover:border-[#F3EFE6]/45 hover:text-[#F3EFE6]"
            >
              <span>{t('openYoutube')}</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trailer"
              className="border border-[#F3EFE6]/16 p-1.5 text-[#A59F95] transition-colors hover:border-[#F3EFE6]/50 hover:text-[#F3EFE6]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative aspect-video w-full bg-black">
          {videoId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={`Trailer ${movie.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <Film className="mb-3 h-10 w-10 text-[#D63628]" aria-hidden="true" />
              <p className="font-editorial text-2xl text-[#F3EFE6]">Trailer</p>
              <a
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 bg-[#D63628] px-5 py-2.5 text-xs font-semibold text-[#F3EFE6] hover:bg-[#E54739]"
              >
                <span>{t('openYoutube')}</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#F3EFE6]/10 bg-[#101014] px-5 py-3 text-xs text-[#746F67]">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {t('director')}: {movie.directors?.join(', ') || '—'}
            </span>
            <span>·</span>
            <span>{formatRuntime(movie.runtime_minutes || 120)}</span>
            {movie.genres?.length > 0 && (
              <>
                <span>·</span>
                <span className="text-[#A59F95]">{movie.genres.map(tGenre).join(', ')}</span>
              </>
            )}
          </div>
          <span>{t('escToClose')}</span>
        </div>
      </div>
    </div>
  );
}

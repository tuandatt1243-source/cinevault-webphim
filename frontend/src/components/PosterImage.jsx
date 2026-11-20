import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Criterion-inspired 2:3 archival film poster component.
 * Uses local FastAPI caching proxy (/api/v1/movies/{movieId}/poster) when movieId is provided
 * so real posters load reliably in <5ms without external CDN drops, with graceful typographic fallback.
 */
export function PosterImage({ movieId, src, title, year, className = '', size = 'md' }) {
  const versionKey = src ? encodeURIComponent(src.slice(-20)) : 'v1';
  const resolvedSrc = movieId && src ? `${API_BASE}/movies/${movieId}/poster?v=${versionKey}` : src || '';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`relative flex aspect-[2/3] w-full flex-col justify-between overflow-hidden border border-[#F3EFE6]/12 bg-[#16161B] p-2.5 text-[#F3EFE6] ${className}`}
      >
        <div className="flex items-center justify-between font-mono-ledger text-[10px] tracking-[0.18em] text-[#746F67] uppercase">
          <span>TF</span>
        </div>
        <div className="my-auto flex flex-col items-center text-center">
          <Film className="mb-1.5 h-4 w-4 text-[#D63628]/80" aria-hidden="true" />
          <span
            className={`font-editorial line-clamp-3 leading-snug text-[#F3EFE6]/90 ${
              size === 'xs' ? 'text-[10px]' : size === 'sm' ? 'text-xs' : 'text-sm'
            }`}
          >
            {title || 'Untitled'}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-[#F3EFE6]/10 pt-1.5 font-mono-ledger text-[10px] text-[#746F67]">
          <span>{year || 'ARCHIVE'}</span>
          <span>2:3</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-[2/3] w-full overflow-hidden border border-[#F3EFE6]/10 bg-[#141418] ${className}`}
    >
      <img
        src={resolvedSrc}
        alt={`Poster phim ${title || ''}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-500 ease-out"
      />
    </div>
  );
}

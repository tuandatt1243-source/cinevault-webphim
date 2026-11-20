import { useRef } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  Play,
  Star,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { PosterImage } from './PosterImage';

/**
 * Reusable Netflix-style Horizontal Swimlane Row.
 * Supports standard poster rows AND ranked Top 10 rows with iconic outlined rank numbers.
 * Designed so TV2 (Neo4j Recommendations) and TV3 (Redis Trending / Recently Watched)
 * can plug their API lists straight into this component.
 */
export function MovieRow({
  title,
  movies = [],
  ranked = false,
  onSeeAll,
  inWatchlist,
  onPlayTrailer,
  onOpenDetail,
  onToggleWatchlist,
}) {
  const { t, tGenre, formatRuntime } = useLanguage();
  const trackRef = useRef(null);

  if (!movies || movies.length === 0) return null;

  const scrollByAmount = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const distance = Math.max(el.clientWidth * 0.8, 320);
    el.scrollBy({ left: dir * distance, behavior: 'smooth' });
  };

  return (
    <section className="group/row relative space-y-3">
      {/* Row Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="font-editorial text-xl font-semibold tracking-tight text-[#F3EFE6] sm:text-2xl">
            {title}
          </h2>
          {onSeeAll && (
            <button
              type="button"
              onClick={onSeeAll}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-[#A59F95] opacity-80 transition-all hover:text-white hover:opacity-100"
            >
              <span>{t('seeAll')}</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="hidden items-center gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            aria-label={`Cuộn trái ${title}`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#F3EFE6]/14 bg-[#141418] text-[#A59F95] transition-colors hover:border-[#F3EFE6]/45 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            aria-label={`Cuộn phải ${title}`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#F3EFE6]/14 bg-[#141418] text-[#A59F95] transition-colors hover:border-[#F3EFE6]/45 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {movies.map((m, idx) => (
          <article
            key={m.id}
            className={`group/card relative flex shrink-0 flex-col ${
              ranked ? 'w-[215px] sm:w-[235px]' : 'w-[155px] sm:w-[175px]'
            }`}
          >
            <div className={`relative flex items-end ${ranked ? 'pl-11 sm:pl-12' : ''}`}>
              {/* Giant Netflix-style Outlined Rank Number (1..10) */}
              {ranked && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-2 left-0 select-none font-mono-ledger text-[96px] font-bold leading-none text-transparent sm:text-[110px]"
                  style={{
                    WebkitTextStroke: '2px rgba(243,239,230,0.45)',
                  }}
                >
                  {idx + 1}
                </span>
              )}

              <div className="relative z-10 w-full overflow-hidden rounded-lg border border-white/10 bg-[#141418] shadow-lg transition-all duration-300 group-hover/card:scale-[1.04] group-hover/card:border-white/35 group-hover/card:shadow-[0_16px_36px_rgba(0,0,0,0.85)]">
                <button
                  type="button"
                  onClick={() => onOpenDetail(m)}
                  className="block w-full text-left"
                >
                  <PosterImage
                    movieId={m.id}
                    src={m.poster_url}
                    title={m.title}
                    year={m.release_year}
                    className="border-0"
                  />
                </button>

                {/* Rating Chip */}
                <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/80 px-1.5 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#E0A43B] backdrop-blur-sm">
                  ★ {m.avg_rating.toFixed(1)}
                </div>

                {/* Hover Quick Controls Overlay */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/85 to-transparent p-2.5 pt-10 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-focus-within/card:opacity-100">
                  <div className="pointer-events-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => onPlayTrailer(m, e)}
                      aria-label={`${t('watchTrailer')} ${m.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0B0B0D] transition-transform hover:scale-105"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => onToggleWatchlist(m, e)}
                      aria-label={inWatchlist(m.id) ? t('inWatchlist') : t('addWatchlist')}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${
                        inWatchlist(m.id)
                          ? 'border-[#E0A43B] bg-[#E0A43B]/20 text-[#E0A43B]'
                          : 'border-white/35 bg-black/55 text-white hover:border-white'
                      }`}
                    >
                      {inWatchlist(m.id) ? (
                        <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDetail(m)}
                      aria-label={`${t('detailsShort')} ${m.title}`}
                      className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-black/55 text-white hover:border-white"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-2 truncate font-mono-ledger text-[10px] text-white/75">
                    {m.release_year} · {formatRuntime(m.runtime_minutes)}
                  </p>
                </div>
              </div>
            </div>

            <div className={`mt-2 ${ranked ? 'pl-11 sm:pl-12' : ''}`}>
              <button type="button" onClick={() => onOpenDetail(m)} className="w-full text-left">
                <h3
                  className="font-editorial line-clamp-1 text-sm font-medium text-[#F3EFE6] transition-colors group-hover/card:text-white"
                  title={m.title}
                >
                  {m.title}
                </h3>
              </button>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#746F67]">
                <Star className="h-3 w-3 fill-[#E0A43B] text-[#E0A43B]" aria-hidden="true" />
                <span className="font-mono-ledger text-[#A59F95]">{m.avg_rating.toFixed(1)}</span>
                <span>·</span>
                <span className="truncate">{tGenre(m.genres?.[0])}</span>
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

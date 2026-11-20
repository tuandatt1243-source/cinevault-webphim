import { useEffect, useState } from 'react';
import { ArrowRight, Clapperboard, Film, Play, Star } from 'lucide-react';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { PosterImage } from './PosterImage';

/**
 * Cinema Time Machine (1920s -> 2020s) inspired by The Criterion Channel.
 * Interactive filmstrip decade scrubber powered by MongoDB decade aggregation.
 */
export function CinemaTimeline({ onOpenDetail, onPlayTrailer, onOpenPerson, onExploreDecade }) {
  const { t, formatRuntime } = useLanguage();
  const [decades, setDecades] = useState([]);
  const [selectedDecade, setSelectedDecade] = useState(1990);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getDecades()
      .then((list) => {
        if (cancelled) return;
        setDecades(list || []);
        if (list && list.length > 0) {
          const preferred = list.find((d) => d.decade === 1990) || list[0];
          setSelectedDecade(preferred.decade);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-[#131318]" />;
  }
  if (!decades.length) return null;

  const activeEra = decades.find((d) => d.decade === selectedDecade) || decades[0];

  return (
    <section
      id="cinema-timeline"
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#13131A] via-[#101015] to-[#0D0D11] p-5 sm:p-7"
    >
      {/* Subtle 35mm Filmstrip Top Perforations */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-4 py-1.5 opacity-20">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="h-1.5 w-3 rounded-[2px] bg-white/60" />
        ))}
      </div>

      {/* Header */}
      <div className="mt-2 flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end">
        <div>
          <p className="inline-flex items-center gap-1.5 font-mono-ledger text-[11px] font-semibold tracking-[0.2em] text-[#E0A43B] uppercase">
            <Film className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('timelineEyebrow')}</span>
          </p>
          <h2 className="font-editorial mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('timelineTitle')}
          </h2>
          <p className="mt-1 text-xs text-[#8C877E] sm:text-sm">{t('timelineSub')}</p>
        </div>

        <button
          type="button"
          onClick={() => onExploreDecade(activeEra.decade, activeEra.label)}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-white/20 bg-white/[0.05] px-4 py-2 text-xs font-medium text-white transition-colors hover:border-white hover:bg-white/15 md:self-auto"
        >
          <span>
            {t('timelineExploreEra')} {activeEra.label} ({activeEra.count})
          </span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Decade Scrubber Tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {decades.map((era) => {
          const isSelected = era.decade === activeEra.decade;
          return (
            <button
              key={era.decade}
              type="button"
              onClick={() => setSelectedDecade(era.decade)}
              className={`group flex shrink-0 flex-col items-start rounded-xl border px-4 py-2.5 text-left transition-all ${
                isSelected
                  ? 'border-[#E0A43B] bg-[#E0A43B]/15 text-white shadow-[0_0_24px_rgba(224,164,59,0.18)]'
                  : 'border-white/10 bg-white/[0.02] text-[#A59F95] hover:border-white/30 hover:text-white'
              }`}
            >
              <span className="font-mono-ledger text-sm font-bold">{era.label}</span>
              <span className="mt-0.5 font-mono-ledger text-[10px] text-[#8C877E] group-hover:text-[#C9C3B8]">
                {era.count} {t('moviesUnit')} · ★ {era.avg_rating.toFixed(1)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Era Spotlight Metadata + Iconic Directors */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/30 px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-[#A59F95]">
          <Clapperboard className="h-3.5 w-3.5 text-[#E0A43B]" aria-hidden="true" />
          <span>{t('timelineDirectors')}:</span>
          {activeEra.top_directors.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onOpenPerson?.(d, 'director')}
              className="rounded-full border border-white/14 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-[#F3EFE6] transition-colors hover:border-[#E0A43B] hover:text-[#E0A43B]"
            >
              {d}
            </button>
          ))}
        </div>

        <span className="font-mono-ledger text-[11px] text-[#8C877E]">
          {t('timelineAvgScore')}: <strong className="text-[#E0A43B]">★ {activeEra.avg_rating.toFixed(2)}</strong>
        </span>
      </div>

      {/* Era Masterpieces Filmstrip */}
      <div className="mt-5 flex gap-4 overflow-x-auto pb-2 pt-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {activeEra.sample_movies.map((m) => (
          <article key={m.id} className="group/era flex w-[148px] shrink-0 flex-col sm:w-[162px]">
            <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#141418] transition-all duration-300 group-hover/era:scale-[1.04] group-hover/era:border-[#E0A43B]/60">
              <button type="button" onClick={() => onOpenDetail(m)} className="block w-full text-left">
                <PosterImage
                  movieId={m.id}
                  src={m.poster_url}
                  title={m.title}
                  year={m.release_year}
                  className="border-0"
                />
              </button>
              <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/80 px-1.5 py-0.5 font-mono-ledger text-[10px] font-semibold text-white">
                {m.release_year}
              </span>
              <button
                type="button"
                onClick={(e) => onPlayTrailer(m, e)}
                aria-label={`${t('watchTrailer')} ${m.title}`}
                className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0B0B0D] opacity-0 shadow-lg transition-all group-hover/era:opacity-100"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              </button>
            </div>

            <button type="button" onClick={() => onOpenDetail(m)} className="mt-2 text-left">
              <h3 className="font-editorial line-clamp-1 text-sm font-medium text-[#F3EFE6] group-hover/era:text-white" title={m.title}>
                {m.title}
              </h3>
              <p className="mt-0.5 flex items-center gap-1 font-mono-ledger text-[11px] text-[#8C877E]">
                <Star className="h-3 w-3 fill-[#E0A43B] text-[#E0A43B]" aria-hidden="true" />
                <span>{m.avg_rating.toFixed(1)}</span>
                <span>·</span>
                <span>{formatRuntime(m.runtime_minutes)}</span>
              </p>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

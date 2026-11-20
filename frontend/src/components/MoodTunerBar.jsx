import { useEffect, useState } from 'react';
import { Shuffle, X } from 'lucide-react';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { MovieRow } from './MovieRow';

export const MOOD_PRESETS = [
  {
    key: 'mindbend',
    index: '01',
    tag: 'SCI-FI · MYSTERY',
    ytStill: 'YoHD9XEInc0', // Inception
    params: { genres: 'Sci-Fi,Mystery,Thriller', min_rating: 3.8, sort: 'views', limit: 15 },
    labelKey: 'moodMindbend',
  },
  {
    key: 'emotional',
    index: '02',
    tag: 'DRAMA · ROMANCE',
    ytStill: 'bLvqoHBptjg', // Forrest Gump
    params: { genres: 'Drama,Romance,Biography', min_rating: 4.0, sort: 'rating', limit: 15 },
    labelKey: 'moodEmotional',
  },
  {
    key: 'adrenaline',
    index: '03',
    tag: 'ACTION · THRILLER',
    ytStill: 'EXeTwQWrcwY', // The Dark Knight
    params: { genres: 'Action,Adventure,War', sort: 'views', limit: 15 },
    labelKey: 'moodAdrenaline',
  },
  {
    key: 'quick',
    index: '04',
    tag: '≤ 100 MIN',
    ytStill: 'CZ1CATNbXg0', // WALL-E
    params: { max_runtime: 100, sort: 'rating', limit: 15 },
    labelKey: 'moodQuick',
  },
  {
    key: 'classic',
    index: '05',
    tag: 'PRE-2000 · IMDB 8+',
    ytStill: 'qtRKdVHc-cE', // Fight Club
    params: { year_to: 1999, min_imdb: 8.0, sort: 'views', limit: 15 },
    labelKey: 'moodClassic',
  },
  {
    key: 'dark',
    index: '06',
    tag: 'CRIME · NOIR',
    ytStill: 's7EdQ4FqbhY', // Pulp Fiction
    params: { genres: 'Horror,Crime,Film-Noir', sort: 'views', limit: 15 },
    labelKey: 'moodDark',
  },
];

function MoodBackdropCard({ preset, label, selected, onClick }) {
  const [imgSrc, setImgSrc] = useState(`https://i.ytimg.com/vi/${preset.ytStill}/maxresdefault.jpg`);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`group relative aspect-[16/10] w-full overflow-hidden rounded-xl border text-left transition-all duration-300 ${
        selected
          ? 'border-[#F3EFE6] ring-1 ring-[#F3EFE6]/40 shadow-[0_14px_36px_rgba(0,0,0,0.7)]'
          : 'border-white/10 hover:border-white/35'
      }`}
    >
      {/* Real Dark-Graded Widescreen Film Still */}
      <img
        src={imgSrc}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => {
          if (imgSrc.includes('maxresdefault.jpg')) {
            setImgSrc(`https://i.ytimg.com/vi/${preset.ytStill}/hqdefault.jpg`);
          }
        }}
        className={`h-full w-full object-cover object-center transition-all duration-500 ease-out ${
          selected
            ? 'scale-105 brightness-[0.68] saturate-100'
            : 'brightness-[0.48] saturate-[0.72] group-hover:scale-105 group-hover:brightness-[0.65] group-hover:saturate-100'
        }`}
      />

      {/* Deep Cinema Vignette for Razor-Sharp Legibility */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(11,11,13,0.35) 0%, rgba(11,11,13,0.18) 38%, rgba(11,11,13,0.92) 100%)',
        }}
      />

      {/* Top Row: Minimal Film Index + Active Indicator */}
      <div className="absolute inset-x-3 top-2.5 flex items-center justify-between">
        <span className="font-mono-ledger text-[10px] tracking-[0.2em] text-white/55">
          {preset.index}
        </span>
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-[#E50914]" />}
      </div>

      {/* Bottom Row: Pure Editorial Cinema Typography (Zero Icons) */}
      <div className="absolute inset-x-3 bottom-2.5">
        <p className="font-mono-ledger text-[9px] tracking-[0.14em] text-[#C9C3B8]/80 uppercase">
          {preset.tag}
        </p>
        <p className="font-editorial mt-0.5 line-clamp-1 text-base font-semibold leading-snug text-[#F3EFE6] group-hover:text-white">
          {label}
        </p>
      </div>
    </button>
  );
}

/**
 * Apple TV+ × Netflix Visual Cinema Mood Deck.
 * Uses real dark-graded widescreen film stills & editorial typography — zero pastel/AI icons.
 */
export function MoodTunerBar({
  onOpenRoulette,
  onExploreMoodInGrid,
  inWatchlist,
  onPlayTrailer,
  onOpenDetail,
  onToggleWatchlist,
}) {
  const { t } = useLanguage();
  const [activeMood, setActiveMood] = useState(null);
  const [moodMovies, setMoodMovies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeMood) {
      setMoodMovies([]);
      return;
    }
    const preset = MOOD_PRESETS.find((m) => m.key === activeMood);
    if (!preset) return;

    let cancelled = false;
    setLoading(true);
    api
      .listMovies(preset.params)
      .then((res) => {
        if (!cancelled) setMoodMovies(res.items || []);
      })
      .catch(() => {
        if (!cancelled) setMoodMovies([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMood]);

  const currentPreset = MOOD_PRESETS.find((m) => m.key === activeMood);

  return (
    <section className="space-y-5">
      {/* Seamless Editorial Header (No SaaS Box, No Sparkles) */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-editorial text-xl font-semibold tracking-tight text-[#F3EFE6] sm:text-2xl">
            {t('moodHeading')}
          </h2>
          <p className="mt-0.5 text-xs text-[#8C877E]">{t('moodSub')}</p>
        </div>

        <div className="flex items-center gap-2">
          {activeMood && (
            <button
              type="button"
              onClick={() => setActiveMood(null)}
              className="inline-flex items-center gap-1 rounded-full border border-white/14 px-3 py-2 text-xs text-[#A59F95] transition-colors hover:border-white/35 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('clearFilter')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenRoulette(activeMood || 'any')}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#F3EFE6]/25 bg-[#F3EFE6] px-4 py-2 text-xs font-semibold text-[#0B0B0D] transition-colors hover:bg-white"
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('rouletteCta')}</span>
          </button>
        </div>
      </div>

      {/* 6 Widescreen Film Still Mood Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {MOOD_PRESETS.map((preset) => (
          <MoodBackdropCard
            key={preset.key}
            preset={preset}
            label={t(preset.labelKey)}
            selected={activeMood === preset.key}
            onClick={() => setActiveMood((cur) => (cur === preset.key ? null : preset.key))}
          />
        ))}
      </div>

      {/* Instant Curated Mood Row */}
      {activeMood && (
        <div className="border-y border-white/10 py-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-[#16161C]" />
              ))}
            </div>
          ) : (
            <MovieRow
              title={currentPreset ? t(currentPreset.labelKey) : ''}
              movies={moodMovies}
              onSeeAll={currentPreset ? () => onExploreMoodInGrid(currentPreset) : undefined}
              inWatchlist={inWatchlist}
              onPlayTrailer={onPlayTrailer}
              onOpenDetail={onOpenDetail}
              onToggleWatchlist={onToggleWatchlist}
            />
          )}
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import {
  Brain,
  Clock,
  Dice5,
  Flame,
  Heart,
  History,
  Moon,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { MovieRow } from './MovieRow';

export const MOOD_PRESETS = [
  {
    key: 'mindbend',
    icon: Brain,
    accent: '#60A5FA',
    params: { genres: 'Sci-Fi,Mystery,Thriller', min_rating: 3.8, sort: 'views', limit: 15 },
    labelKey: 'moodMindbend',
  },
  {
    key: 'emotional',
    icon: Heart,
    accent: '#F472B6',
    params: { genres: 'Drama,Romance,Biography', min_rating: 4.0, sort: 'rating', limit: 15 },
    labelKey: 'moodEmotional',
  },
  {
    key: 'adrenaline',
    icon: Flame,
    accent: '#FB923C',
    params: { genres: 'Action,Adventure,War', sort: 'views', limit: 15 },
    labelKey: 'moodAdrenaline',
  },
  {
    key: 'quick',
    icon: Clock,
    accent: '#34D399',
    params: { max_runtime: 100, sort: 'rating', limit: 15 },
    labelKey: 'moodQuick',
  },
  {
    key: 'classic',
    icon: History,
    accent: '#E0A43B',
    params: { year_to: 1999, min_imdb: 8.0, sort: 'views', limit: 15 },
    labelKey: 'moodClassic',
  },
  {
    key: 'dark',
    icon: Moon,
    accent: '#F87171',
    params: { genres: 'Horror,Crime,Film-Noir', sort: 'views', limit: 15 },
    labelKey: 'moodDark',
  },
];

/**
 * Tactile Mood & Vibe Tuner bar (Netflix 2026 + MUBI curation).
 * Lets viewers pick a mood or duration in 1 click, or launch Tito Roulette.
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
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#121217]/85 p-4 backdrop-blur-md sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E50914]/15 text-[#E50914]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{t('moodHeading')}</p>
              <p className="text-xs text-[#8C877E]">{t('moodSub')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenRoulette(activeMood || 'any')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E50914] to-[#B81D24] px-5 py-2.5 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(229,9,20,0.35)] transition-transform duration-150 hover:scale-[1.02] hover:brightness-110"
          >
            <Dice5 className="h-4 w-4" aria-hidden="true" />
            <span>{t('rouletteCta')}</span>
          </button>
        </div>

        {/* Interactive Mood Pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {MOOD_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const selected = activeMood === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveMood((cur) => (cur === preset.key ? null : preset.key))}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  selected
                    ? 'border-white bg-white text-[#0B0B0D] shadow-md'
                    : 'border-white/12 bg-white/[0.03] text-[#D8D3C8] hover:border-white/35 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <Icon
                  className="h-3.5 w-3.5"
                  style={{ color: selected ? '#0B0B0D' : preset.accent }}
                  aria-hidden="true"
                />
                <span>{t(preset.labelKey)}</span>
              </button>
            );
          })}

          {activeMood && (
            <button
              type="button"
              onClick={() => setActiveMood(null)}
              className="inline-flex items-center gap-1 rounded-full border border-white/12 px-3 py-2 text-xs text-[#8C877E] hover:border-white/35 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('clearFilter')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Instant Mood Result Row */}
      {activeMood && (
        <div className="rounded-2xl border border-white/10 bg-[#111116]/90 p-5 sm:p-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-[#1A1A22]" />
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

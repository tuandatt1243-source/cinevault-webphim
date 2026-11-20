import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Dice5,
  Info,
  Play,
  RefreshCw,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useLanguage, useTranslatedOverview } from '../context/LanguageContext';
import { MOOD_PRESETS } from './MoodTunerBar';
import { PosterImage } from './PosterImage';
import { extractYouTubeId } from './TrailerModal';
import { YouTubeBackdropPlayer } from './YouTubeBackdropPlayer';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Tito Roulette — Interactive Cinema Night Picker backed by MongoDB $sample aggregation.
 * Lets users spin a real animated reel filtered by mood & available time, then watch HD trailer immediately.
 */
export function TitoRouletteModal({
  open,
  initialMood = 'any',
  inWatchlist,
  onPlayTrailer,
  onOpenDetail,
  onToggleWatchlist,
  onClose,
}) {
  const { t, tGenre, formatRuntime } = useLanguage();
  const [mood, setMood] = useState(initialMood || 'any');
  const [maxRuntime, setMaxRuntime] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [displayIdx, setDisplayIdx] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [muted, setMuted] = useState(true);
  const spinTimersRef = useRef([]);

  const clearTimers = () => {
    spinTimersRef.current.forEach((id) => window.clearTimeout(id));
    spinTimersRef.current = [];
  };

  useEffect(() => {
    if (open) {
      setMood(initialMood || 'any');
      setMuted(true);
    } else {
      clearTimers();
      setSpinning(false);
    }
  }, [open, initialMood]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const runSpin = useCallback(
    async (selectedMood = mood, selectedRuntime = maxRuntime) => {
      clearTimers();
      setSpinning(true);
      setWinner(null);
      try {
        const list = await api.getRoulette({
          mood: selectedMood,
          max_runtime: selectedRuntime ? Number(selectedRuntime) : undefined,
          limit: 12,
        });
        if (!list || list.length === 0) {
          setSpinning(false);
          return;
        }
        setCandidates(list);

        // Decelerating theatrical slot spin across the sampled films
        const totalSteps = Math.min(14, Math.max(8, list.length + 3));
        let elapsed = 0;
        for (let step = 0; step <= totalSteps; step++) {
          const delay = step < 6 ? 70 : step < 10 ? 115 : 175 + (step - 10) * 55;
          elapsed += delay;
          const timerId = window.setTimeout(() => {
            const idx = step === totalSteps ? 0 : step % list.length;
            setDisplayIdx(idx);
            if (step === totalSteps) {
              setWinner(list[0]);
              setSpinning(false);
            }
          }, elapsed);
          spinTimersRef.current.push(timerId);
        }
      } catch {
        setSpinning(false);
      }
    },
    [mood, maxRuntime]
  );

  // Auto-spin once when modal opens cleanly
  useEffect(() => {
    if (open) {
      runSpin(initialMood || 'any', '');
    }
    return () => clearTimers();
  }, [open, initialMood]);

  const activeFilm = winner || candidates[displayIdx] || null;
  const synopsis = useTranslatedOverview(winner);

  if (!open) return null;

  const videoId = winner ? extractYouTubeId(winner.trailer_url) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-3 py-6 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Tito Roulette"
    >
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-[#121217] shadow-[0_32px_100px_rgba(0,0,0,0.92)]">
        {/* Top Controls Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E50914] text-white">
              <Dice5 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-editorial text-xl font-bold text-white">{t('rouletteTitle')}</h2>
              <p className="text-xs text-[#8C877E]">{t('rouletteSub')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#A59F95] hover:border-white hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mood + Duration Controls */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-[#0E0E13] px-6 py-3.5">
          <select
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            aria-label="Chọn tâm trạng"
            className="rounded-full border border-white/15 bg-[#16161D] px-3.5 py-1.5 text-xs text-white focus:border-white/50 focus:outline-none"
          >
            <option value="any">{t('rouletteAnyMood')}</option>
            {MOOD_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {t(p.labelKey)}
              </option>
            ))}
          </select>

          <select
            value={maxRuntime}
            onChange={(e) => setMaxRuntime(e.target.value)}
            aria-label="Chọn thời lượng tối đa"
            className="rounded-full border border-white/15 bg-[#16161D] px-3.5 py-1.5 text-xs text-white focus:border-white/50 focus:outline-none"
          >
            <option value="">{t('rouletteAnyDuration')}</option>
            <option value="100">≤ 100 {t('runtimeUnit')}</option>
            <option value="130">≤ 130 {t('runtimeUnit')}</option>
            <option value="160">≤ 160 {t('runtimeUnit')}</option>
          </select>

          <button
            type="button"
            disabled={spinning}
            onClick={() => runSpin(mood, maxRuntime)}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#E50914] px-5 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.02] hover:bg-[#F40612] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{spinning ? t('rouletteSpinning') : t('rouletteSpinAgain')}</span>
          </button>
        </div>

        {/* Stage Area: Spinning Reel OR Winner with HD Trailer */}
        <div className="relative min-h-[380px] overflow-hidden bg-[#0A0A0D]">
          {winner && videoId && (
            <YouTubeBackdropPlayer
              videoId={videoId}
              posterFallback={`${API_BASE}/movies/${winner.id}/poster`}
              title={winner.title}
              muted={muted}
              paused={false}
              startSeconds={14}
            />
          )}

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(10,10,13,0.95) 0%, rgba(10,10,13,0.75) 55%, rgba(10,10,13,0.45) 100%)',
            }}
          />

          {winner && videoId && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
              className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-md hover:border-white"
            >
              {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}

          <div className="relative z-10 flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-end sm:p-8">
            {/* Spinning / Revealed Poster Card */}
            <div
              className={`w-40 shrink-0 overflow-hidden rounded-xl border bg-[#16161D] shadow-2xl transition-all duration-150 sm:w-48 ${
                spinning
                  ? 'scale-95 border-[#E50914] ring-2 ring-[#E50914]/50'
                  : 'scale-100 border-white/25'
              }`}
            >
              {activeFilm ? (
                <PosterImage
                  movieId={activeFilm.id}
                  src={activeFilm.poster_url}
                  title={activeFilm.title}
                  year={activeFilm.release_year}
                  className="border-0"
                />
              ) : (
                <div className="aspect-[2/3] animate-pulse bg-[#1B1B24]" />
              )}
            </div>

            {/* Metadata + CTAs */}
            <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3 py-1 font-mono-ledger text-[11px] text-[#E0A43B] backdrop-blur-sm">
                <span>{spinning ? t('rouletteSpinning') : t('rouletteTonightPick')}</span>
              </div>

              <h3 className="font-editorial text-2xl font-bold leading-tight text-white sm:text-3xl">
                {activeFilm?.title || '...'}
              </h3>

              {activeFilm && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#D8D3C8] sm:justify-start">
                  <span className="inline-flex items-center gap-1 font-mono-ledger font-semibold text-[#E0A43B]">
                    <Star className="h-3.5 w-3.5 fill-[#E0A43B]" aria-hidden="true" />
                    {activeFilm.avg_rating.toFixed(1)}
                  </span>
                  {activeFilm.imdb_rating && (
                    <span className="rounded bg-[#E0A43B]/15 px-1.5 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#E0A43B]">
                      IMDb {activeFilm.imdb_rating.toFixed(1)}
                    </span>
                  )}
                  <span className="font-mono-ledger">{activeFilm.release_year}</span>
                  <span>·</span>
                  <span>{formatRuntime(activeFilm.runtime_minutes)}</span>
                  <span>·</span>
                  <span>{activeFilm.genres?.slice(0, 2).map(tGenre).join(' / ')}</span>
                </div>
              )}

              {winner && (
                <>
                  <p className="line-clamp-3 text-sm leading-relaxed text-[#D8D3C8]">
                    {synopsis.text}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 sm:justify-start">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onPlayTrailer(winner);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-[#0B0B0D] transition-transform hover:scale-[1.02]"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      <span>{t('watchTrailer')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenDetail(winner);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-white/18 px-5 py-2.5 text-xs font-medium text-white backdrop-blur-md hover:bg-white/28"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('detailsReviews')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => onToggleWatchlist(winner, e)}
                      aria-label={inWatchlist(winner.id) ? t('inWatchlist') : t('addWatchlist')}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md ${
                        inWatchlist(winner.id)
                          ? 'border-[#E0A43B] bg-[#E0A43B]/20 text-[#E0A43B]'
                          : 'border-white/30 bg-black/50 text-white hover:border-white'
                      }`}
                    >
                      {inWatchlist(winner.id) ? (
                        <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Bookmark className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

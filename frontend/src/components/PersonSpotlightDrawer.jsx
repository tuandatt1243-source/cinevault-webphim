import { useEffect, useState } from 'react';
import { Award, Clapperboard, Film, Play, Star, User, X } from 'lucide-react';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { PosterImage } from './PosterImage';

/**
 * Director & Actor Spotlight Slide-Over Dossier (Criterion-inspired).
 * Triggered whenever the user clicks a director or cast member name anywhere in Titofilm.
 */
export function PersonSpotlightDrawer({ person, onClose, onSelectMovie, onPlayTrailer }) {
  const { t, tGenre } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!person?.name) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getPersonSpotlight(person.name, person.role || 'director')
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const onEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onEsc);
    };
  }, [person, onClose]);

  if (!person?.name) return null;

  const isDirector = (person.role || 'director') === 'director';

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={person.name}
    >
      <div className="fixed inset-0" onClick={onClose} />

      <aside className="relative z-10 flex h-dvh w-full max-w-xl flex-col overflow-hidden border-l border-white/14 bg-[#121217] shadow-[-24px_0_80px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#16161D] px-6 py-5">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E0A43B]/35 bg-[#E0A43B]/12 px-2.5 py-0.5 font-mono-ledger text-[10px] font-semibold tracking-wider text-[#E0A43B] uppercase">
              {isDirector ? (
                <Clapperboard className="h-3 w-3" aria-hidden="true" />
              ) : (
                <User className="h-3 w-3" aria-hidden="true" />
              )}
              <span>{isDirector ? t('director') : t('cast')}</span>
            </span>
            <h2 className="font-editorial text-3xl font-bold text-white">{person.name}</h2>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-20 animate-pulse rounded-xl bg-[#1A1A22]" />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="aspect-[2/3] animate-pulse rounded-lg bg-[#1A1A22]" />
                ))}
              </div>
            </div>
          ) : !data || data.movie_count === 0 ? (
            <p className="py-12 text-center text-sm text-[#8C877E]">{t('personNoMovies')}</p>
          ) : (
            <div className="space-y-6">
              {/* Career Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
                  <p className="flex items-center gap-1 text-[11px] text-[#8C877E]">
                    <Film className="h-3 w-3" aria-hidden="true" />
                    <span>{t('personFilmCount')}</span>
                  </p>
                  <p className="font-mono-ledger mt-1 text-2xl font-bold text-white">{data.movie_count}</p>
                  <p className="font-mono-ledger text-[10px] text-[#746F67]">{data.year_span}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
                  <p className="flex items-center gap-1 text-[11px] text-[#8C877E]">
                    <Star className="h-3 w-3 text-[#E0A43B]" aria-hidden="true" />
                    <span>Titofilm</span>
                  </p>
                  <p className="font-mono-ledger mt-1 text-2xl font-bold text-[#E0A43B]">
                    {data.avg_rating.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[#746F67]">/ 5.0</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
                  <p className="flex items-center gap-1 text-[11px] text-[#8C877E]">
                    <Award className="h-3 w-3 text-[#E0A43B]" aria-hidden="true" />
                    <span>IMDb</span>
                  </p>
                  <p className="font-mono-ledger mt-1 text-2xl font-bold text-white">
                    {data.avg_imdb ? data.avg_imdb.toFixed(1) : '—'}
                  </p>
                  <p className="text-[10px] text-[#746F67]">/ 10</p>
                </div>
              </div>

              {/* Signature Genres */}
              {data.top_genres?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.top_genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-[#D8D3C8]"
                    >
                      {tGenre(g)}
                    </span>
                  ))}
                </div>
              )}

              {/* Filmography Grid */}
              <div>
                <h3 className="mb-3 text-xs font-semibold tracking-wider text-[#8C877E] uppercase">
                  {t('personFilmography')} ({data.movies.length})
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {data.movies.map((m) => (
                    <article key={m.id} className="group flex flex-col">
                      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#181820] transition-transform duration-200 group-hover:scale-[1.03] group-hover:border-white/35">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectMovie(m);
                          }}
                          className="block w-full text-left"
                        >
                          <PosterImage
                            movieId={m.id}
                            src={m.poster_url}
                            title={m.title}
                            year={m.release_year}
                            size="sm"
                            className="border-0"
                          />
                        </button>
                        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono-ledger text-[10px] font-semibold text-[#E0A43B]">
                          ★ {m.avg_rating.toFixed(1)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => onPlayTrailer(m, e)}
                          aria-label={`${t('watchTrailer')} ${m.title}`}
                          className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0B0B0D] opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectMovie(m);
                        }}
                        className="mt-1.5 text-left"
                      >
                        <p className="font-editorial line-clamp-1 text-sm font-medium text-[#F3EFE6] group-hover:text-white">
                          {m.title}
                        </p>
                        <p className="font-mono-ledger text-[11px] text-[#746F67]">{m.release_year}</p>
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

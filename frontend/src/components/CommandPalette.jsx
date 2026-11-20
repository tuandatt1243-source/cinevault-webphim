import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Film,
  Flame,
  Globe,
  History,
  Play,
  Search,
  ShieldCheck,
  Shuffle,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { PosterImage } from './PosterImage';

/**
 * Global Cinema Command Palette (Ctrl+K / Cmd+K / `/`).
 * Instant movie search with mini posters + quick jump commands + full keyboard navigation.
 */
export function CommandPalette({
  open,
  onClose,
  isAdmin = false,
  onSelectMovie,
  onPlayTrailer,
  onNavigateView,
  onOpenRoulette,
  onJumpTimeline,
  onOpenAdmin,
}) {
  const { t, lang, setLang, languages } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  const quickActions = useMemo(() => {
    const actions = [
      {
        id: 'act-reels',
        type: 'action',
        icon: Play,
        label: t('cmdOpenReels'),
        hint: 'HD 1080p',
        run: () => {
          onNavigateView('reels');
          onClose();
        },
      },
      {
        id: 'act-roulette',
        type: 'action',
        icon: Shuffle,
        label: t('rouletteCta'),
        hint: 'Random',
        run: () => {
          onClose();
          onOpenRoulette('any');
        },
      },
      {
        id: 'act-timeline',
        type: 'action',
        icon: History,
        label: t('timelineTitle'),
        hint: '1920s–2020s',
        run: () => {
          onClose();
          onJumpTimeline();
        },
      },
      {
        id: 'act-browse',
        type: 'action',
        icon: Compass,
        label: t('catalogNav'),
        hint: 'All',
        run: () => {
          onNavigateView('browse');
          onClose();
        },
      },
      {
        id: 'act-popular',
        type: 'action',
        icon: Flame,
        label: t('popularNav'),
        hint: 'New',
        run: () => {
          onNavigateView('popular');
          onClose();
        },
      },
    ];
    if (isAdmin) {
      actions.push({
        id: 'act-admin',
        type: 'action',
        icon: ShieldCheck,
        label: t('adminPanel'),
        hint: 'Admin',
        run: () => {
          onClose();
          onOpenAdmin();
        },
      });
    }
    return actions;
  }, [t, isAdmin, onNavigateView, onClose, onOpenRoulette, onJumpTimeline, onOpenAdmin]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setActiveIdx(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api
        .listMovies({ q: trimmed, limit: 8, sort: 'views' })
        .then((res) => {
          if (!cancelled) {
            setResults(res.items || []);
            setActiveIdx(0);
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const selectableItems = query.trim()
    ? results.map((m) => ({
        id: m.id,
        type: 'movie',
        movie: m,
        run: () => {
          onClose();
          onSelectMovie(m);
        },
      }))
    : quickActions;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (selectableItems.length ? (i + 1) % selectableItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) =>
          selectableItems.length ? (i - 1 + selectableItems.length) % selectableItems.length : 0
        );
      } else if (e.key === 'Enter' && selectableItems[activeIdx]) {
        e.preventDefault();
        selectableItems[activeIdx].run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, selectableItems, activeIdx, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/80 px-4 pt-[10vh] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Titofilm Command Palette"
    >
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/16 bg-[#13131A] shadow-[0_32px_100px_rgba(0,0,0,0.92)]">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-[#A59F95]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('cmdPlaceholder')}
            className="w-full bg-transparent text-sm text-white placeholder:text-[#746F67] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Xóa từ khóa"
              className="text-[#8C877E] hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <kbd className="hidden rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono-ledger text-[10px] text-[#8C877E] sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results OR Quick Actions */}
        <div className="max-h-[58vh] overflow-y-auto p-2">
          {query.trim() ? (
            loading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-14 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#8C877E]">{t('cmdNoResults')}</div>
            ) : (
              <ul className="space-y-1">
                {results.map((m, idx) => {
                  const focused = idx === activeIdx;
                  return (
                    <li
                      key={m.id}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                        focused ? 'bg-white/10' : 'hover:bg-white/[0.05]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectMovie(m);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="w-9 shrink-0 overflow-hidden rounded">
                          <PosterImage
                            movieId={m.id}
                            src={m.poster_url}
                            title={m.title}
                            year={m.release_year}
                            size="xs"
                            className="border-0"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-editorial truncate text-sm font-medium text-white">{m.title}</p>
                          <p className="truncate font-mono-ledger text-[11px] text-[#8C877E]">
                            {m.release_year} · {m.directors?.[0] || '—'} · ★ {m.avg_rating.toFixed(1)}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onPlayTrailer(m);
                        }}
                        aria-label={`${t('watchTrailer')} ${m.title}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#E50914]"
                      >
                        <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                        <span>Trailer</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <div className="space-y-4 p-2">
              <div>
                <p className="px-2 pb-1.5 font-mono-ledger text-[10px] font-semibold tracking-wider text-[#746F67] uppercase">
                  {t('cmdQuickActions')}
                </p>
                <ul className="space-y-1">
                  {quickActions.map((act, idx) => {
                    const Icon = act.icon;
                    const focused = idx === activeIdx;
                    return (
                      <li key={act.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={act.run}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                            focused ? 'bg-white/12 text-white' : 'text-[#D8D3C8] hover:bg-white/[0.06]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 transition-colors ${focused ? 'text-[#F3EFE6]' : 'text-[#8C877E]'}`}
                              aria-hidden="true"
                            />
                            <span className="font-medium">{act.label}</span>
                          </span>
                          <span className="font-mono-ledger text-[10px] text-[#746F67]">{act.hint}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Quick Language Switcher Row */}
              <div className="border-t border-white/8 pt-3">
                <p className="flex items-center gap-1.5 px-2 pb-2 font-mono-ledger text-[10px] font-semibold tracking-wider text-[#746F67] uppercase">
                  <Globe className="h-3 w-3" aria-hidden="true" />
                  <span>{t('cmdSwitchLanguage')}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 px-2">
                  {languages.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setLang(item.code)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        item.code === lang
                          ? 'border-[#E50914] bg-[#E50914] font-medium text-white'
                          : 'border-white/12 text-[#A59F95] hover:border-white/35 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between border-t border-white/8 bg-[#0E0E13] px-4 py-2 font-mono-ledger text-[10px] text-[#746F67]">
          <span className="flex items-center gap-2">
            <Film className="h-3 w-3 text-[#8C877E]" aria-hidden="true" />
            <span>Titofilm Spotlight</span>
          </span>
          <span className="flex items-center gap-3">
            <span>↑↓ {t('cmdNavigate')}</span>
            <span>↵ {t('cmdSelect')}</span>
            <span>ESC</span>
          </span>
        </div>
      </div>
    </div>
  );
}

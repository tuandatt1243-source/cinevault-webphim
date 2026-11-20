import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Info, Play, Star } from 'lucide-react';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { PosterImage } from './PosterImage';
import { extractYouTubeId } from './TrailerModal';

const ERA_CURATION = {
  1950: {
    stillId: 'TEN-2uTi2c0',
    tagline: {
      vi: 'Thời đại Hoàng kim & Nghệ thuật Đen trắng',
      en: 'The Golden Age & Black-and-White Mastery',
      ja: '映画の黄金時代とモノクロームの美学',
      ko: '황금기와 흑백 영화의 미학',
      fr: 'L’Âge d’or & la maîtrise du noir et blanc',
      zh: '黄金时代与黑白电影美学',
    },
  },
  1960: {
    stillId: 'IFNUGzCOQoI',
    tagline: {
      vi: 'Làn sóng Mới & Bản anh hùng ca Viễn Tây',
      en: 'New Waves & Widescreen Epics',
      ja: 'ヌーヴェルヴァーグと叙事詩の時代',
      ko: '누벨바그와 와이드스크린 서사시',
      fr: 'Nouvelles Vagues & fresques cinématographiques',
      zh: '新浪潮与宽银幕史诗',
    },
  },
  1970: {
    stillId: 'UaVTIH8mujA',
    tagline: {
      vi: 'Làn sóng Hollywood Mới & Những bậc thầy Tác giả',
      en: 'New Hollywood & Rise of the Auteurs',
      ja: 'アメリカン・ニューシネマと巨匠たちの台頭',
      ko: '뉴 할리우드와 거장 감독들의 시대',
      fr: 'Le Nouvel Hollywood & l’ère des auteurs',
      zh: '新好莱坞与作者导演的崛起',
    },
  },
  1980: {
    stillId: 'JNwNXF9Y6kY',
    tagline: {
      vi: 'Kỷ nguyên Khoa học viễn tưởng & Biểu tượng Đại chúng',
      en: 'Sci-Fi Blockbusters & Cultural Icons',
      ja: 'SF大作とポップカルチャーの象徴',
      ko: 'SF 블록버스터와 대중문화의 아이콘',
      fr: 'Grands classiques SF & icônes populaires',
      zh: '科幻巨制与流行文化经典',
    },
  },
  1990: {
    stillId: 'qtRKdVHc-cE',
    tagline: {
      vi: 'Hoàng kim Phim Độc lập & Những cú twist Kinh điển',
      en: 'Indie Renaissance & Modern Classics',
      ja: 'インディーズ映画の黄金期と不朽の名作',
      ko: '인디 영화의 르네상스와 현대 고전',
      fr: 'Renaissance indépendante & chefs-d’œuvre modernes',
      zh: '独立电影复兴与现代影史经典',
    },
  },
  2000: {
    stillId: 'EXeTwQWrcwY',
    tagline: {
      vi: 'Sử thi Hiện đại & Kỷ nguyên Hình ảnh Số',
      en: 'Modern Epics & The Digital Frontier',
      ja: '現代の叙事詩とデジタル映像革命',
      ko: '현대 서사시와 디지털 영상 혁명',
      fr: 'Épopées modernes & révolution numérique',
      zh: '现代史诗与数字影像纪元',
    },
  },
  2010: {
    stillId: 'YoHD9XEInc0',
    tagline: {
      vi: 'Điện ảnh Đa tầng & Tư duy Thị giác Mới',
      en: 'High-Concept Cinema & Bold Visual Worlds',
      ja: '重層的な物語と新世代の映像世界',
      ko: '하이콘셉트 시네마와 대담한 미장센',
      fr: 'Cinéma conceptuel & visions audacieuses',
      zh: '高概念叙事与先锋视觉美学',
    },
  },
  2020: {
    stillId: 'Way9Dexny3w',
    tagline: {
      vi: 'Điện ảnh Đương đại & Tiếng nói Mới',
      en: 'Contemporary Voices & New Horizons',
      ja: '現代映画の新たな地平',
      ko: '동시대 영화의 새로운 지평',
      fr: 'Voix contemporaines & nouveaux horizons',
      zh: '当代影像与新生代声音',
    },
  },
};

/**
 * Criterion × MUBI × Apple TV+ Dynamic Era Exhibition (1920s -> 2020s).
 * Zero nested SaaS boxes — chronological ruler, dynamic cinema backdrop,
 * asymmetrical featured masterpiece stage, and clean unobstructed poster strip.
 */
export function CinemaTimeline({ onOpenDetail, onPlayTrailer, onOpenPerson, onExploreDecade }) {
  const { t, lang, formatRuntime } = useLanguage();
  const [decades, setDecades] = useState([]);
  const [selectedDecade, setSelectedDecade] = useState(1990);
  const [loading, setLoading] = useState(true);
  const [backdropFallback, setBackdropFallback] = useState(false);
  const stripRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getDecades()
      .then((list) => {
        if (cancelled) return;
        // Sort chronologically left -> right (1920s-50s -> 2020s)
        const chronological = [...(list || [])].sort((a, b) => a.decade - b.decade);
        setDecades(chronological);
        if (chronological.length > 0) {
          const preferred = chronological.find((d) => d.decade === 1990) || chronological[chronological.length - 1];
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

  useEffect(() => {
    setBackdropFallback(false);
    if (stripRef.current) {
      stripRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [selectedDecade]);

  const activeEra = useMemo(
    () => decades.find((d) => d.decade === selectedDecade) || decades[0] || null,
    [decades, selectedDecade]
  );

  if (loading) {
    return <div className="h-[460px] animate-pulse rounded-2xl bg-[#111116]" />;
  }
  if (!activeEra) return null;

  const curation = ERA_CURATION[activeEra.decade] || ERA_CURATION[1990];
  const eraTagline = curation.tagline[lang] || curation.tagline.vi;

  // Prefer the film matching our verified HD still as the Era's Featured Masterpiece
  const featuredFilm =
    activeEra.sample_movies.find((m) => extractYouTubeId(m.trailer_url) === curation.stillId) ||
    activeEra.sample_movies[0] ||
    null;

  const featuredYtId = (featuredFilm && extractYouTubeId(featuredFilm.trailer_url)) || curation.stillId;
  const backdropUrl = backdropFallback
    ? `https://i.ytimg.com/vi/${curation.stillId}/hqdefault.jpg`
    : `https://i.ytimg.com/vi/${featuredYtId}/maxresdefault.jpg`;

  const remainingFilms = activeEra.sample_movies.filter((m) => !featuredFilm || m.id !== featuredFilm.id);

  const scrollStrip = (dir) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.75, 300), behavior: 'smooth' });
  };

  return (
    <section
      id="cinema-timeline"
      className="relative isolate overflow-hidden border-y border-white/10 py-10 sm:py-12"
    >
      {/* Dynamic Atmospheric Era Backdrop (fades smoothly into #0B0B0D canvas) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <img
          key={backdropUrl}
          src={backdropUrl}
          alt=""
          onError={() => setBackdropFallback(true)}
          className="h-full w-full scale-105 object-cover object-center opacity-28 blur-[3px] saturate-[0.75] transition-opacity duration-700"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(85% 75% at 72% 35%, rgba(11,11,13,0.45) 0%, rgba(11,11,13,0.92) 72%, #0B0B0D 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, #0B0B0D 0%, rgba(11,11,13,0.35) 20%, rgba(11,11,13,0.55) 75%, #0B0B0D 100%)',
          }}
        />
      </div>

      {/* Subtle Monumental Era Numeral Watermark */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 top-16 -z-10 select-none font-editorial text-[120px] font-bold leading-none tracking-tighter text-white/[0.035] sm:text-[180px]"
      >
        {activeEra.label}
      </span>

      {/* Top Chronological Timeline Ruler (No Boxes — Clean Film Axis) */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/12 pb-1 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono-ledger text-[10px] tracking-[0.26em] text-[#8C877E] uppercase">
            {t('timelineEyebrow')}
          </p>
          <h2 className="font-editorial mt-1 text-2xl font-semibold tracking-tight text-[#F3EFE6] sm:text-3xl">
            {t('timelineTitle')}
          </h2>
        </div>

        {/* Chronological Decade Stops */}
        <div
          role="tablist"
          aria-label="Chọn thập kỷ điện ảnh"
          className="flex items-center gap-5 overflow-x-auto sm:gap-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {decades.map((era) => {
            const active = era.decade === activeEra.decade;
            return (
              <button
                key={era.decade}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedDecade(era.decade)}
                className={`relative shrink-0 pb-3 text-left transition-colors ${
                  active ? 'text-white' : 'text-[#746F67] hover:text-[#D8D3C8]'
                }`}
              >
                <span className={`font-mono-ledger block text-sm ${active ? 'font-bold' : 'font-medium'}`}>
                  {era.decade <= 1950 ? '1920–50s' : era.label}
                </span>
                <span className="font-mono-ledger block text-[10px] opacity-65">{era.count}</span>
                {active && (
                  <span className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-[#E50914]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Asymmetrical Exhibition Stage: Editorial Column (Left) + Featured Masterpiece 16:9 Frame (Right) */}
      <div className="mt-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        {/* Left 5 Cols: Era Editorial Storytelling & Magazine Director Credits */}
        <div className="space-y-5 lg:col-span-5">
          <div>
            <p className="font-editorial text-5xl font-bold leading-none tracking-tight text-white sm:text-6xl">
              {activeEra.label}
            </p>
            <p className="font-editorial mt-2.5 text-lg leading-snug text-[#D8D3C8] sm:text-xl">
              {eraTagline}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono-ledger text-xs text-[#8C877E]">
            <span>
              <strong className="text-[#F3EFE6]">{activeEra.count}</strong> {t('moviesUnit')}
            </span>
            <span className="text-white/25">·</span>
            <span className="inline-flex items-center gap-1">
              <span>{t('timelineAvgScore')}</span>
              <strong className="text-[#E0A43B]">★ {activeEra.avg_rating.toFixed(2)}</strong>
            </span>
          </div>

          {/* Magazine-Style Inline Director Credits (No Box, No Pills) */}
          {activeEra.top_directors?.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <p className="font-mono-ledger text-[10px] tracking-[0.2em] text-[#746F67] uppercase">
                {t('timelineDirectors')}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#C9C3B8]">
                {activeEra.top_directors.map((d, idx) => (
                  <span key={d} className="inline-flex items-center gap-2">
                    {idx > 0 && <span className="text-white/25">·</span>}
                    <button
                      type="button"
                      onClick={() => onOpenPerson?.(d, 'director')}
                      className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
                    >
                      {d}
                    </button>
                  </span>
                ))}
              </p>
            </div>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={() => onExploreDecade(activeEra.decade, activeEra.label)}
              className="group inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#F3EFE6] transition-colors hover:text-white"
            >
              <span className="border-b border-white/35 pb-0.5 transition-colors group-hover:border-white">
                {t('timelineExploreEra')} {activeEra.label} ({activeEra.count})
              </span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Right 7 Cols: Featured Era Masterpiece Widescreen Frame */}
        {featuredFilm && (
          <div className="lg:col-span-7">
            <div className="group relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/12 bg-[#121217] shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
              <img
                src={backdropUrl}
                alt={featuredFilm.title}
                onError={() => setBackdropFallback(true)}
                className="h-full w-full object-cover object-center brightness-[0.8] transition-transform duration-700 ease-out group-hover:scale-[1.03] group-hover:brightness-90"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(11,11,13,0.12) 0%, rgba(11,11,13,0.25) 45%, rgba(11,11,13,0.95) 100%)',
                }}
              />

              <div className="absolute inset-x-0 bottom-0 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
                <div className="min-w-0">
                  <p className="font-mono-ledger text-[11px] text-[#E0A43B]">
                    {featuredFilm.release_year} · ★ {featuredFilm.avg_rating.toFixed(1)}
                    {featuredFilm.imdb_rating ? ` · IMDb ${featuredFilm.imdb_rating.toFixed(1)}` : ''} ·{' '}
                    {formatRuntime(featuredFilm.runtime_minutes)}
                  </p>
                  <h3 className="font-editorial mt-1 truncate text-2xl font-bold text-white sm:text-3xl">
                    {featuredFilm.title}
                  </h3>
                  {featuredFilm.directors?.[0] && (
                    <p className="mt-0.5 text-xs text-[#C9C3B8]">{featuredFilm.directors.join(', ')}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => onPlayTrailer(featuredFilm, e)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#F3EFE6] px-4 py-2 text-xs font-semibold text-[#0B0B0D] transition-colors hover:bg-white"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>Trailer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDetail(featuredFilm)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-white/25"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('detailsShort')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unobstructed Archival Poster Strip for the Selected Era */}
      {remainingFilms.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono-ledger text-[10px] tracking-[0.2em] text-[#746F67] uppercase">
              {activeEra.label} · {t('featured')}
            </span>
            <div className="hidden items-center gap-1.5 sm:flex">
              <button
                type="button"
                onClick={() => scrollStrip(-1)}
                aria-label="Cuộn trái"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/12 text-[#8C877E] transition-colors hover:border-white/40 hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollStrip(1)}
                aria-label="Cuộn phải"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/12 text-[#8C877E] transition-colors hover:border-white/40 hover:text-white"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            ref={stripRef}
            className="flex gap-4 overflow-x-auto pb-2 pt-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {remainingFilms.map((m) => (
              <article key={m.id} className="group/era flex w-[138px] shrink-0 flex-col sm:w-[152px]">
                <div className="relative overflow-hidden rounded-lg border border-white/8 bg-[#141418] transition-all duration-300 group-hover/era:scale-[1.04] group-hover/era:border-white/35">
                  <button type="button" onClick={() => onOpenDetail(m)} className="block w-full text-left">
                    <PosterImage
                      movieId={m.id}
                      src={m.poster_url}
                      title={m.title}
                      year={m.release_year}
                      className="border-0"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onPlayTrailer(m, e)}
                    aria-label={`${t('watchTrailer')} ${m.title}`}
                    className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#F3EFE6] text-[#0B0B0D] opacity-0 shadow-lg transition-opacity group-hover/era:opacity-100"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  </button>
                </div>

                <button type="button" onClick={() => onOpenDetail(m)} className="mt-2 text-left">
                  <h4
                    className="font-editorial line-clamp-1 text-sm font-medium text-[#E2DDD4] transition-colors group-hover/era:text-white"
                    title={m.title}
                  >
                    {m.title}
                  </h4>
                  <p className="mt-0.5 flex items-center gap-1.5 font-mono-ledger text-[11px] text-[#746F67]">
                    <span>{m.release_year}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5 text-[#A59F95]">
                      <Star className="h-2.5 w-2.5 fill-[#E0A43B] text-[#E0A43B]" aria-hidden="true" />
                      {m.avg_rating.toFixed(1)}
                    </span>
                  </p>
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

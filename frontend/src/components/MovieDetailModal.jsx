import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart2,
  Bookmark,
  BookmarkCheck,
  Clock,
  Eye,
  Heart,
  Languages,
  Play,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useLanguage, useTranslatedOverview } from '../context/LanguageContext';
import { PosterImage } from './PosterImage';
import { RatingStars } from './RatingStars';
import { extractYouTubeId } from './TrailerModal';
import { YouTubeBackdropPlayer } from './YouTubeBackdropPlayer';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const CONSENSUS_STYLE = {
  acclaimed: { key: 'consensusAcclaimed', cls: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300' },
  favorable: { key: 'consensusFavorable', cls: 'border-[#E0A43B]/35 bg-[#E0A43B]/15 text-[#E0A43B]' },
  divisive: { key: 'consensusDivisive', cls: 'border-orange-400/35 bg-orange-500/15 text-orange-300' },
  mixed: { key: 'consensusMixed', cls: 'border-white/20 bg-white/8 text-[#D8D3C8]' },
  emerging: { key: 'consensusEmerging', cls: 'border-sky-400/30 bg-sky-500/12 text-sky-300' },
};

/**
 * Netflix × Letterboxd Center Movie Detail Modal:
 * - 16:9 HD Trailer header + mute toggle
 * - Triple Scores (Titofilm ★, IMDb, Metascore)
 * - Letterboxd 5-Star Rating Histogram (live MongoDB aggregation)
 * - Clickable Director & Cast opening PersonSpotlightDrawer
 * - More from Director strip + Spoiler Shield on reviews
 */
export function MovieDetailModal({
  movie,
  user,
  inWatchlist,
  liked,
  reviews = [],
  reviewsLoading = false,
  reviewsError = '',
  myRating,
  onChangeRating,
  myComment,
  onChangeComment,
  myIsSpoiler = false,
  onChangeIsSpoiler,
  myExistingReviewId,
  submittingReview,
  onSubmitReview,
  onDeleteMyReview,
  onPlayFullTrailer,
  onToggleWatchlist,
  onLikeMovie,
  onOpenPerson,
  onSelectMovie,
  onClose,
  pausedExternal = false,
  insightsRefreshTick = 0,
  similarMoviesSlot = null,
}) {
  const { t, tGenre, formatRuntime } = useLanguage();
  const synopsis = useTranslatedOverview(movie);
  const [muted, setMuted] = useState(true);
  const [insights, setInsights] = useState(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState({});

  useEffect(() => {
    setMuted(true);
    setRevealedSpoilers({});
    if (!movie) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [movie?.id, onClose]);

  useEffect(() => {
    if (!movie?.id) {
      setInsights(null);
      return;
    }
    let cancelled = false;
    api
      .getMovieInsights(movie.id)
      .then((res) => {
        if (!cancelled) setInsights(res);
      })
      .catch(() => {
        if (!cancelled) setInsights(null);
      });
    return () => {
      cancelled = true;
    };
  }, [movie?.id, insightsRefreshTick]);

  if (!movie) return null;

  const videoId = extractYouTubeId(movie.trailer_url);
  const fallbackPoster = `${API_BASE}/movies/${movie.id}/poster`;
  const consensusMeta = CONSENSUS_STYLE[insights?.consensus] || CONSENSUS_STYLE.emerging;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/82 p-3 py-6 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={movie.title}
    >
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl border border-white/14 bg-[#141418] shadow-[0_32px_90px_rgba(0,0,0,0.9)]">
        {/* Top 16:9 HD Trailer Header */}
        <div className="relative aspect-video max-h-[420px] w-full overflow-hidden bg-black">
          <YouTubeBackdropPlayer
            videoId={videoId}
            posterFallback={fallbackPoster}
            title={movie.title}
            muted={muted}
            paused={pausedExternal}
            startSeconds={8}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(20,20,24,0.2) 0%, rgba(20,20,24,0.12) 45%, #141418 100%)',
            }}
          />

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition-colors hover:bg-black"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-4 px-6 pb-6 sm:px-8">
            <div className="space-y-3">
              <h2 className="font-editorial text-3xl font-bold text-white drop-shadow sm:text-4xl">
                {movie.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onPlayFullTrailer(movie)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-[#0B0B0D] transition-transform hover:scale-[1.02] hover:bg-white/90"
                >
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span>{t('playTrailer')}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => onToggleWatchlist(movie, e)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium backdrop-blur-md transition-colors ${
                    inWatchlist
                      ? 'border-[#E0A43B] bg-[#E0A43B]/20 text-[#E0A43B]'
                      : 'border-white/35 bg-black/50 text-white hover:border-white'
                  }`}
                >
                  {inWatchlist ? (
                    <>
                      <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('savedWatchlist')}</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('addWatchlist')}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onLikeMovie(movie)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium backdrop-blur-md transition-colors ${
                    liked
                      ? 'border-[#E50914] bg-[#E50914]/20 text-white'
                      : 'border-white/30 bg-black/50 text-white/85 hover:border-white hover:text-white'
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-[#E50914] text-[#E50914]' : ''}`} aria-hidden="true" />
                  <span>{liked ? t('liked') : t('like')}</span>
                </button>
              </div>
            </div>

            {videoId && (
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white backdrop-blur-md hover:border-white"
              >
                {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>

        {/* Body Details */}
        <div className="space-y-8 p-6 sm:p-8">
          {/* 2-Column Metadata & Clickable Credits */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="space-y-3.5 md:col-span-8">
              {/* Triple Score Bar: Titofilm + IMDb + Metascore */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#A59F95]">
                <span className="inline-flex items-center gap-1 font-mono-ledger text-sm font-semibold text-[#E0A43B]">
                  <Star className="h-3.5 w-3.5 fill-[#E0A43B]" aria-hidden="true" />
                  {movie.avg_rating.toFixed(2)} / 5
                </span>
                {movie.imdb_rating && (
                  <span className="rounded bg-[#E0A43B]/18 px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#E0A43B]">
                    IMDb {movie.imdb_rating.toFixed(1)}
                  </span>
                )}
                {movie.meta_score && (
                  <span
                    className={`rounded px-2 py-0.5 font-mono-ledger text-[11px] font-semibold ${
                      movie.meta_score >= 70
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : movie.meta_score >= 50
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    Metascore {movie.meta_score}
                  </span>
                )}
                <span className="font-mono-ledger text-[#F3EFE6]">{movie.release_year}</span>
                <span>{formatRuntime(movie.runtime_minutes)}</span>
                {movie.certificate && (
                  <span className="rounded border border-white/25 px-1.5 py-0.5 font-mono-ledger text-[11px] text-white">
                    {movie.certificate}
                  </span>
                )}
                <span className="font-mono-ledger text-[#746F67]">
                  {movie.rating_count} {t('reviewsCount')} · {movie.views_count.toLocaleString('vi-VN')} {t('viewsCount')}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-[#E2DDD4]">{synopsis.text}</p>
              <div className="flex items-center gap-3">
                {synopsis.translating && <span className="text-xs text-[#746F67]">{t('translating')}</span>}
                {synopsis.canToggleOriginal && (
                  <button
                    type="button"
                    onClick={synopsis.toggleOriginal}
                    className="inline-flex items-center gap-1 text-xs text-[#A59F95] underline decoration-white/20 underline-offset-4 hover:text-white"
                  >
                    <Languages className="h-3 w-3" aria-hidden="true" />
                    <span>{synopsis.showOriginal ? t('showTranslated') : t('showOriginal')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Clickable Director & Cast Chips */}
            <dl className="space-y-3 text-xs md:col-span-4">
              <div>
                <dt className="text-[#746F67]">{t('director')}:</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {movie.directors?.length ? (
                    movie.directors.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onOpenPerson?.(d, 'director')}
                        className="rounded-md border border-white/14 bg-white/[0.04] px-2 py-0.5 text-left text-xs text-[#F3EFE6] transition-colors hover:border-[#E0A43B] hover:text-[#E0A43B]"
                      >
                        {d}
                      </button>
                    ))
                  ) : (
                    <span className="text-[#746F67]">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[#746F67]">{t('cast')}:</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {movie.cast?.length ? (
                    movie.cast.map((actor) => (
                      <button
                        key={actor}
                        type="button"
                        onClick={() => onOpenPerson?.(actor, 'actor')}
                        className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-0.5 text-left text-[11px] text-[#C9C3B8] transition-colors hover:border-white/40 hover:text-white"
                      >
                        {actor}
                      </button>
                    ))
                  ) : (
                    <span className="text-[#746F67]">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[#746F67]">{t('genres')}:</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {movie.genres?.map((g) => (
                    <span key={g} className="rounded bg-white/8 px-2 py-0.5 text-[11px] text-[#E2DDD4]">
                      {tGenre(g)}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          {/* Letterboxd-style 5-Star Rating Distribution Histogram */}
          {insights && (
            <div className="rounded-xl border border-white/10 bg-[#181820]/80 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-[#D8D3C8] uppercase">
                  <BarChart2 className="h-4 w-4 text-[#E0A43B]" aria-hidden="true" />
                  <span>{t('ratingDistribution')}</span>
                </h3>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${consensusMeta.cls}`}>
                  {t(consensusMeta.key)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 items-center gap-5 sm:grid-cols-12">
                <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 p-4 text-center sm:col-span-3">
                  <span className="font-mono-ledger text-3xl font-bold text-[#E0A43B]">
                    {insights.avg_rating.toFixed(2)}
                  </span>
                  <div className="mt-1">
                    <RatingStars value={Math.round(insights.avg_rating)} size="sm" />
                  </div>
                  <span className="mt-1 font-mono-ledger text-[11px] text-[#8C877E]">
                    {insights.total_reviews.toLocaleString('vi-VN')} {t('reviewsCount')}
                  </span>
                </div>

                <div className="space-y-2 sm:col-span-9">
                  {insights.histogram.map((bucket) => (
                    <div key={bucket.stars} className="flex items-center gap-3 text-xs">
                      <span className="w-8 shrink-0 font-mono-ledger text-[#D8D3C8]">{bucket.stars} ★</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#E0A43B] to-[#F5C16C] transition-all duration-700"
                          style={{ width: `${Math.max(bucket.count > 0 ? 3 : 0, bucket.percent)}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right font-mono-ledger text-[11px] text-[#8C877E]">
                        {bucket.percent.toFixed(0)}% ({bucket.count})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* More From Same Director (MongoDB Insights) */}
          {insights?.more_from_director?.length > 0 && (
            <div className="space-y-3 border-t border-white/10 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wider text-[#A59F95] uppercase">
                  {t('moreFromDirector')} · {movie.directors?.[0]}
                </h3>
                {movie.directors?.[0] && (
                  <button
                    type="button"
                    onClick={() => onOpenPerson?.(movie.directors[0], 'director')}
                    className="text-xs text-[#E0A43B] hover:underline"
                  >
                    {t('seeAll')} →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {insights.more_from_director.map((dm) => (
                  <button
                    key={dm.id}
                    type="button"
                    onClick={() => onSelectMovie?.(dm)}
                    className="group text-left"
                  >
                    <div className="overflow-hidden rounded-lg border border-white/10 transition-transform duration-200 group-hover:scale-[1.04] group-hover:border-white/35">
                      <PosterImage
                        movieId={dm.id}
                        src={dm.poster_url}
                        title={dm.title}
                        year={dm.release_year}
                        size="xs"
                        className="border-0"
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-xs font-medium text-[#E2DDD4] group-hover:text-white">
                      {dm.title}
                    </p>
                    <p className="font-mono-ledger text-[10px] text-[#746F67]">
                      {dm.release_year} · ★ {dm.avg_rating.toFixed(1)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Plug-in Slot for TV2 Neo4j Similar Movies */}
          {similarMoviesSlot}

          {/* User Review Form with Spoiler Shield */}
          <div className="border-t border-white/10 pt-6">
            <h3 className="font-editorial text-xl font-semibold text-white">{t('writeReview')}</h3>
            {user ? (
              <form onSubmit={onSubmitReview} className="mt-4 space-y-3 rounded-xl border border-white/10 bg-[#1B1B22] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#A59F95]">{t('ratingLabel')}</span>
                  <div className="flex items-center gap-2">
                    <RatingStars value={myRating} interactive onChange={onChangeRating} size="md" />
                    <span className="font-mono-ledger text-xs text-[#E0A43B]">{myRating}/5</span>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={myComment}
                  onChange={(e) => onChangeComment(e.target.value)}
                  placeholder={t('commentPlaceholder')}
                  className="w-full rounded-lg border border-white/12 bg-[#111116] px-3.5 py-2.5 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-white/40 focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#A59F95] hover:text-white">
                    <input
                      type="checkbox"
                      checked={Boolean(myIsSpoiler)}
                      onChange={(e) => onChangeIsSpoiler?.(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-white/30 bg-[#111116] accent-[#E50914]"
                    />
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    <span>{t('spoilerCheckbox')}</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {myExistingReviewId && (
                      <button
                        type="button"
                        disabled={submittingReview}
                        onClick={onDeleteMyReview}
                        className="rounded-full border border-[#E04848]/40 px-4 py-1.5 text-xs text-[#E04848] hover:bg-[#E04848]/15 disabled:opacity-50"
                      >
                        {t('deleteMyReview')}
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="rounded-full bg-[#E50914] px-5 py-2 text-xs font-semibold text-white hover:bg-[#F40612] disabled:opacity-50"
                    >
                      {submittingReview ? '...' : myExistingReviewId ? t('updateReview') : t('submitReview')}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <p className="mt-2 text-xs text-[#A59F95]">
                <Link to="/login" className="text-white underline">
                  {t('signIn')}
                </Link>{' '}
                {t('loginToReview')}
              </p>
            )}
          </div>

          {/* Community Reviews with Spoiler Shield */}
          <div className="space-y-3 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-[#A59F95] uppercase">
                {t('communityReviews')} ({reviews.length})
              </h3>
              <Clock className="h-3.5 w-3.5 text-[#746F67]" aria-hidden="true" />
            </div>
            {reviewsLoading ? (
              <div className="h-20 animate-pulse rounded-lg bg-[#1D1D24]" />
            ) : reviewsError ? (
              <p className="text-xs text-[#E04848]">{reviewsError}</p>
            ) : reviews.length === 0 ? (
              <p className="text-xs text-[#746F67]">{t('noReviewsYet')}</p>
            ) : (
              <ul className="divide-y divide-white/8">
                {reviews.map((rev) => {
                  const isHiddenSpoiler = Boolean(rev.is_spoiler) && !revealedSpoilers[rev.id];
                  return (
                    <li key={rev.id} className="py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#F3EFE6]">{rev.user_name || 'Thành viên'}</span>
                          {rev.is_spoiler && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                              SPOILER
                            </span>
                          )}
                        </div>
                        <RatingStars value={rev.rating} size="sm" />
                      </div>

                      {isHiddenSpoiler ? (
                        <div className="relative mt-2 overflow-hidden rounded-lg border border-amber-500/25 bg-black/35 p-3">
                          <p className="select-none text-xs text-[#A59F95] blur-sm" aria-hidden="true">
                            {rev.comment || 'Spoiler content hidden.'}
                          </p>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                            <button
                              type="button"
                              onClick={() => setRevealedSpoilers((prev) => ({ ...prev, [rev.id]: true }))}
                              className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-[#141418]/90 px-3.5 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{t('revealSpoiler')}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-xs leading-relaxed text-[#A59F95]">{rev.comment}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

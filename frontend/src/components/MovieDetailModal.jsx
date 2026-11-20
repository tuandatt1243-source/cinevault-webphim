import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  BookmarkCheck,
  Clock,
  Heart,
  Languages,
  Play,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useLanguage, useTranslatedOverview } from '../context/LanguageContext';
import { RatingStars } from './RatingStars';
import { extractYouTubeId } from './TrailerModal';
import { YouTubeBackdropPlayer } from './YouTubeBackdropPlayer';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Netflix-style Center Movie Detail Modal with embedded 16:9 HD Trailer header,
 * translated synopsis, watchlist/like actions, and user review editor.
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
  myExistingReviewId,
  submittingReview,
  onSubmitReview,
  onDeleteMyReview,
  onPlayFullTrailer,
  onToggleWatchlist,
  onLikeMovie,
  onClose,
  pausedExternal = false,
  similarMoviesSlot = null,
}) {
  const { t, tGenre, formatRuntime } = useLanguage();
  const synopsis = useTranslatedOverview(movie);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    setMuted(true);
    if (!movie) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [movie, onClose]);

  if (!movie) return null;

  const videoId = extractYouTubeId(movie.trailer_url);
  const fallbackPoster = `${API_BASE}/movies/${movie.id}/poster`;

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

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition-colors hover:bg-black"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Bottom-Left Title & Primary Actions inside Hero Header */}
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

        {/* Body Details: 2-Column Netflix Metadata */}
        <div className="space-y-8 p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="space-y-3 md:col-span-8">
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#A59F95]">
                <span className="inline-flex items-center gap-1 font-mono-ledger text-sm font-semibold text-[#E0A43B]">
                  <Star className="h-3.5 w-3.5 fill-[#E0A43B]" aria-hidden="true" />
                  {movie.avg_rating.toFixed(2)} / 5
                </span>
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

            <dl className="space-y-2.5 text-xs md:col-span-4">
              <div>
                <dt className="text-[#746F67]">{t('director')}:</dt>
                <dd className="mt-0.5 text-[#F3EFE6]">{movie.directors?.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-[#746F67]">{t('cast')}:</dt>
                <dd className="mt-0.5 text-[#C9C3B8]">{movie.cast?.join(', ') || '—'}</dd>
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

          {/* Optional Plug-in Slot for TV2 Neo4j Similar Movies */}
          {similarMoviesSlot}

          {/* User Review Form */}
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
                <div className="flex items-center justify-between gap-2">
                  {myExistingReviewId ? (
                    <button
                      type="button"
                      disabled={submittingReview}
                      onClick={onDeleteMyReview}
                      className="rounded-full border border-[#E04848]/40 px-4 py-1.5 text-xs text-[#E04848] hover:bg-[#E04848]/15 disabled:opacity-50"
                    >
                      {t('deleteMyReview')}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="rounded-full bg-[#E50914] px-5 py-2 text-xs font-semibold text-white hover:bg-[#F40612] disabled:opacity-50"
                  >
                    {submittingReview ? '...' : myExistingReviewId ? t('updateReview') : t('submitReview')}
                  </button>
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

          {/* Community Reviews */}
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
                {reviews.map((rev) => (
                  <li key={rev.id} className="py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#F3EFE6]">{rev.user_name || 'Thành viên'}</span>
                      <RatingStars value={rev.rating} size="sm" />
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#A59F95]">{rev.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

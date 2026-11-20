import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Play, Star } from 'lucide-react';
import { api } from '../api/client';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { PosterImage } from '../components/PosterImage';
import { TrailerModal } from '../components/TrailerModal';
import { useAuth } from '../context/AuthContext';
import { useLanguage, useTranslatedOverview } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

export function LoginPage() {
  const { user, login, register } = useAuth();
  const { t, tGenre, formatRuntime } = useLanguage();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showcaseMovies, setShowcaseMovies] = useState([]);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [trailerMovie, setTrailerMovie] = useState(null);

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/catalog', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    api
      .listMovies({ limit: 6, sort: 'views' })
      .then((res) => setShowcaseMovies(res.items || []))
      .catch(() => {});
  }, []);

  const featuredMovie = showcaseMovies[featuredIdx] || showcaseMovies[0] || null;
  const featuredSynopsis = useTranslatedOverview(featuredMovie);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      let signedInUser;
      if (mode === 'login') {
        signedInUser = await login(email.trim(), password);
      } else {
        signedInUser = await register({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          favorite_genres: ['Drama', 'Sci-Fi'],
        });
      }
      pushToast({
        title: mode === 'login' ? t('signIn') : t('signUp'),
        description: `${signedInUser.full_name}`,
        variant: 'success',
      });
      navigate(signedInUser.role === 'admin' ? '/admin' : '/catalog', { replace: true });
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (role) => {
    setMode('login');
    setError('');
    if (role === 'admin') {
      setEmail('admin@titofilm.local');
      setPassword('Admin@123');
    } else {
      setEmail('minh.anh@titofilm.local');
      setPassword('User@123');
    }
  };

  return (
    <div className="cinema-grain flex min-h-dvh w-full overflow-x-hidden bg-[#0B0B0D] text-[#F3EFE6]">
      {/* Left 52-55%: Interactive Cinema Film Spotlight */}
      <section className="relative hidden shrink-0 flex-col justify-between overflow-hidden border-r border-white/10 bg-[#0E0E12] px-8 py-8 lg:flex lg:w-[52%] xl:w-[55%] xl:px-12 xl:py-10">
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-3 p-6 opacity-16">
          {(showcaseMovies.length > 0 ? showcaseMovies : Array.from({ length: 6 })).map((m, idx) => (
            <div key={m?.id || idx} className="overflow-hidden rounded-lg">
              {m ? (
                <PosterImage movieId={m.id} src={m.poster_url} title={m.title} year={m.release_year} className="border-0" />
              ) : (
                <div className="aspect-[2/3] w-full bg-[#17171D]" />
              )}
            </div>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 30% 45%, rgba(14,14,18,0.72) 0%, rgba(11,11,13,0.95) 76%)',
          }}
        />

        {/* Top Bar (z-30 cleanly above center film stage so language dropdown never overlaps) */}
        <div className="relative z-30 flex items-center justify-between gap-3">
          <Link to="/catalog" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#E50914] font-editorial text-lg font-bold text-white shadow-md">
              T
            </span>
            <span className="font-editorial text-2xl font-bold tracking-tight text-[#E50914]">
              TITOFILM
            </span>
          </Link>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher compact />
            <Link
              to="/catalog"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3.5 py-1.5 text-xs text-[#F3EFE6] backdrop-blur-sm transition-colors hover:border-white hover:bg-white/12"
            >
              <span>{t('browseCatalog')}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Center Featured Film Stage */}
        {featuredMovie ? (
          <div className="relative z-10 my-auto py-6">
            <div className="flex flex-col items-start gap-7 xl:flex-row xl:items-center">
              <div className="group relative w-44 shrink-0 overflow-hidden rounded-xl shadow-[0_24px_54px_rgba(0,0,0,0.82)] ring-1 ring-white/18 xl:w-52">
                <PosterImage
                  movieId={featuredMovie.id}
                  src={featuredMovie.poster_url}
                  title={featuredMovie.title}
                  year={featuredMovie.release_year}
                  className="border-0"
                />
                <button
                  type="button"
                  onClick={() => setTrailerMovie(featuredMovie)}
                  className="absolute inset-x-3 bottom-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#F3EFE6] py-2 text-xs font-semibold text-[#0B0B0D] shadow-lg transition-colors hover:bg-white"
                >
                  <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                  <span>{t('watchTrailer')}</span>
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#A59F95]">
                  <span className="rounded bg-[#E50914] px-2 py-0.5 text-[11px] font-semibold text-white">
                    {t('featuredShort')}
                  </span>
                  <span className="font-mono-ledger text-[#F3EFE6]">{featuredMovie.release_year}</span>
                  <span>·</span>
                  <span className="font-mono-ledger">{formatRuntime(featuredMovie.runtime_minutes)}</span>
                  {featuredMovie.certificate && (
                    <>
                      <span>·</span>
                      <span className="rounded border border-white/20 px-1.5 py-0.5 font-mono-ledger text-[10px] text-[#F3EFE6]">
                        {featuredMovie.certificate}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 font-mono-ledger font-semibold text-[#E0A43B]">
                    <Star className="h-3.5 w-3.5 fill-[#E0A43B]" aria-hidden="true" />
                    {featuredMovie.avg_rating.toFixed(1)}
                  </span>
                </div>

                <h1 className="font-editorial mt-3 text-3xl font-bold leading-[1.15] text-white xl:text-4xl">
                  {featuredMovie.title}
                </h1>

                {featuredMovie.genres?.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {featuredMovie.genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-full border border-white/14 bg-white/[0.05] px-2.5 py-0.5 text-[11px] text-[#C9C3B8]"
                      >
                        {tGenre(g)}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-xs leading-relaxed text-[#A59F95]">
                  {t('director')}: <span className="text-[#F3EFE6]">{featuredMovie.directors?.join(', ') || '—'}</span>
                  {featuredMovie.cast?.length > 0 && (
                    <>
                      <br />
                      {t('cast')}: <span className="text-[#D8D3C8]">{featuredMovie.cast.slice(0, 4).join(', ')}</span>
                    </>
                  )}
                </p>

                <p className="mt-3.5 line-clamp-4 text-sm leading-relaxed text-[#C9C3B8]">
                  {featuredSynopsis.text}
                </p>
                {featuredSynopsis.translating && (
                  <p className="mt-1 text-[11px] text-[#746F67]">{t('translating')}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 my-auto max-w-lg">
            <h1 className="font-editorial text-4xl font-bold leading-[1.2] text-[#F3EFE6]">
              Titofilm
            </h1>
          </div>
        )}

        {/* Bottom Thumbnail Selector Rail */}
        {showcaseMovies.length > 1 && (
          <div className="relative z-10 border-t border-white/10 pt-4">
            <div className="mb-2.5 flex items-center justify-between text-xs text-[#746F67]">
              <span>{t('pickPosterHint')}</span>
              <span className="font-mono-ledger">
                {featuredIdx + 1} / {showcaseMovies.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {showcaseMovies.map((m, idx) => {
                const isSelected = idx === featuredIdx;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFeaturedIdx(idx)}
                    title={m.title}
                    aria-label={m.title}
                    aria-pressed={isSelected}
                    className={`w-13 overflow-hidden rounded-md border transition-all duration-200 ${
                      isSelected
                        ? '-translate-y-1 border-[#F3EFE6] opacity-100 shadow-lg ring-1 ring-white/40'
                        : 'border-white/14 opacity-50 hover:-translate-y-0.5 hover:opacity-85'
                    }`}
                  >
                    <PosterImage movieId={m.id} src={m.poster_url} title={m.title} year={m.release_year} size="xs" className="border-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Right 45-48%: Clean Sign-In / Sign-Up Form */}
      <section className="flex min-w-0 flex-1 flex-col justify-center px-6 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-sm xl:max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/catalog" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-[#E50914] font-editorial text-base font-bold text-white">
                T
              </span>
              <span className="font-editorial text-xl font-bold text-[#E50914]">TITOFILM</span>
            </Link>
            <LanguageSwitcher compact />
          </div>

          {/* Mode Tabs */}
          <div className="mb-7 flex border-b border-white/12">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 border-b-2 pb-3 text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'border-b-[#E50914] text-white'
                  : 'border-b-transparent text-[#746F67] hover:text-[#F3EFE6]'
              }`}
            >
              {t('signIn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 border-b-2 pb-3 text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'border-b-[#E50914] text-white'
                  : 'border-b-transparent text-[#746F67] hover:text-[#F3EFE6]'
              }`}
            >
              {t('signUp')}
            </button>
          </div>

          <h2 className="font-editorial text-3xl font-semibold text-white">
            {mode === 'login' ? t('signIn') : t('createAccountTitle')}
          </h2>
          <p className="mt-1.5 text-sm text-[#A59F95]">
            {mode === 'login' ? t('loginSub') : t('registerSub')}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-[#E04848]/45 bg-[#E04848]/10 px-4 py-3 text-xs leading-relaxed text-[#F3EFE6]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-fullname" className="block text-xs font-medium text-[#A59F95]">
                  {t('fullName')} <span className="text-[#E50914]">*</span>
                </label>
                <input
                  id="auth-fullname"
                  type="text"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  className="mt-1.5 w-full rounded-xl border border-white/14 bg-[#141419] px-3.5 py-2.5 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-white/50 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#A59F95]">
                Email <span className="text-[#E50914]">*</span>
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="email@titofilm.local"
                className="mt-1.5 w-full rounded-xl border border-white/14 bg-[#141419] px-3.5 py-2.5 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-white/50 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-[#A59F95]">
                {t('password')} <span className="text-[#E50914]">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  id="auth-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/14 bg-[#141419] py-2.5 pl-3.5 pr-10 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-white/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#746F67] hover:text-[#F3EFE6]"
                >
                  {showPw ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-full bg-[#E50914] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#F40612] disabled:opacity-50"
            >
              {submitting ? '...' : mode === 'login' ? t('signIn') : t('signUp')}
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="text-xs text-[#746F67]">{t('demoQuickLabel')}</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fillDemo('admin')}
                className="rounded-xl border border-white/14 bg-[#141419] px-3 py-2.5 text-xs font-medium text-[#F3EFE6] transition-colors hover:border-white/40 hover:bg-[#1B1B22]"
              >
                {t('demoAdmin')}
              </button>
              <button
                type="button"
                onClick={() => fillDemo('user')}
                className="rounded-xl border border-white/14 bg-[#141419] px-3 py-2.5 text-xs text-[#A59F95] transition-colors hover:border-white/40 hover:text-white"
              >
                {t('demoUser')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <TrailerModal
        open={Boolean(trailerMovie)}
        movie={trailerMovie}
        onClose={() => setTrailerMovie(null)}
      />
    </div>
  );
}

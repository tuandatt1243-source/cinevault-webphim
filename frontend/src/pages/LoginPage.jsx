import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clapperboard, Eye, EyeOff, ArrowRight, Play, Star } from 'lucide-react';
import { api } from '../api/client';
import { PosterImage } from '../components/PosterImage';
import { TrailerModal } from '../components/TrailerModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function LoginPage() {
  const { user, login, register } = useAuth();
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
      .listMovies({ limit: 6, sort: 'rating' })
      .then((res) => setShowcaseMovies(res.items || []))
      .catch(() => {});
  }, []);

  const featuredMovie = showcaseMovies[featuredIdx] || showcaseMovies[0] || null;

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
        title: mode === 'login' ? 'Đăng nhập thành công' : 'Đăng ký thành công',
        description: `Xin chào, ${signedInUser.full_name}.`,
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
      setEmail('admin@cinevault.local');
      setPassword('Admin@123');
    } else {
      setEmail('minh.anh@cinevault.local');
      setPassword('User@123');
    }
  };

  return (
    <div className="cinema-grain flex min-h-dvh w-full overflow-x-hidden bg-[#0B0B0D] text-[#F3EFE6]">
      {/* Left 52-55%: Interactive Film Spotlight with Featured Poster above */}
      <section className="relative hidden shrink-0 flex-col justify-between overflow-hidden border-r border-[#F3EFE6]/10 bg-[#0E0E11] px-8 py-8 lg:flex lg:w-[52%] xl:w-[55%] xl:px-12 xl:py-10">
        {/* Subtle Background Poster Mosaic */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-3 p-6 opacity-18">
          {(showcaseMovies.length > 0 ? showcaseMovies : Array.from({ length: 6 })).map((m, idx) => (
            <div key={m?.id || idx} className="overflow-hidden">
              {m ? (
                <PosterImage movieId={m.id} src={m.poster_url} title={m.title} year={m.release_year} />
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
              'radial-gradient(circle at 30% 45%, rgba(14,14,17,0.72) 0%, rgba(11,11,13,0.94) 75%)',
          }}
        />

        {/* Top Bar */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/catalog" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center bg-[#D63628] text-[#F3EFE6]">
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-editorial text-2xl font-bold tracking-tight">CineVault</span>
          </Link>
          <Link
            to="/catalog"
            className="inline-flex items-center gap-1.5 border border-[#F3EFE6]/20 px-3.5 py-1.5 text-xs text-[#F3EFE6] transition-colors hover:border-[#F3EFE6] hover:bg-[#F3EFE6]/10"
          >
            <span>Xem danh mục phim</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Center Featured Film Stage: Large Crisp Poster + Film Details */}
        {featuredMovie ? (
          <div className="relative z-10 my-auto py-6">
            <div className="flex flex-col items-start gap-7 xl:flex-row xl:items-center">
              {/* Featured 2:3 Poster Card */}
              <div className="group relative w-44 shrink-0 shadow-[0_24px_48px_rgba(0,0,0,0.75)] ring-1 ring-[#F3EFE6]/20 xl:w-52">
                <PosterImage
                  movieId={featuredMovie.id}
                  src={featuredMovie.poster_url}
                  title={featuredMovie.title}
                  year={featuredMovie.release_year}
                />
                <button
                  type="button"
                  onClick={() => setTrailerMovie(featuredMovie)}
                  className="absolute inset-x-2.5 bottom-2.5 inline-flex items-center justify-center gap-1.5 bg-[#0B0B0D]/90 py-2 text-xs font-medium text-[#F3EFE6] ring-1 ring-[#F3EFE6]/25 backdrop-blur-sm transition-colors hover:bg-[#D63628] hover:ring-[#D63628]"
                >
                  <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                  <span>Xem Trailer</span>
                </button>
              </div>

              {/* Film Details & Synopsis */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#A59F95]">
                  <span className="bg-[#D63628] px-2 py-0.5 text-[11px] font-medium text-[#F3EFE6]">
                    Phim nổi bật
                  </span>
                  <span className="font-mono-ledger text-[#F3EFE6]">{featuredMovie.release_year}</span>
                  <span>·</span>
                  <span className="font-mono-ledger">{featuredMovie.runtime_minutes} phút</span>
                  {featuredMovie.certificate && (
                    <>
                      <span>·</span>
                      <span className="border border-[#F3EFE6]/20 px-1.5 py-0.5 font-mono-ledger text-[10px] text-[#F3EFE6]">
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

                <h1 className="font-editorial mt-3 text-3xl font-semibold leading-[1.18] text-[#F3EFE6] xl:text-4xl">
                  {featuredMovie.title}
                </h1>

                {featuredMovie.genres?.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {featuredMovie.genres.map((g) => (
                      <span
                        key={g}
                        className="border border-[#F3EFE6]/14 bg-[#15151B]/90 px-2 py-0.5 text-[11px] text-[#C9C3B8]"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-xs leading-relaxed text-[#A59F95]">
                  Đạo diễn: <span className="text-[#F3EFE6]">{featuredMovie.directors?.join(', ') || '—'}</span>
                  {featuredMovie.cast?.length > 0 && (
                    <>
                      <br />
                      Diễn viên: <span className="text-[#D8D3C8]">{featuredMovie.cast.slice(0, 4).join(', ')}</span>
                    </>
                  )}
                </p>

                <p className="mt-3.5 line-clamp-4 text-sm leading-relaxed text-[#C9C3B8]">
                  {featuredMovie.overview}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 my-auto max-w-lg">
            <h1 className="font-editorial text-4xl font-semibold leading-[1.2] text-[#F3EFE6]">
              Khám phá và lưu lại những bộ phim đáng xem nhất.
            </h1>
          </div>
        )}

        {/* Bottom Thumbnail Selector Rail */}
        {showcaseMovies.length > 1 && (
          <div className="relative z-10 border-t border-[#F3EFE6]/12 pt-4">
            <div className="mb-2.5 flex items-center justify-between text-xs text-[#746F67]">
              <span>Chọn poster để xem nhanh thông tin phim</span>
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
                    aria-label={`Xem thông tin phim ${m.title}`}
                    aria-pressed={isSelected}
                    className={`w-13 overflow-hidden border transition-all duration-200 ${
                      isSelected
                        ? '-translate-y-1 border-[#E0A43B] opacity-100 shadow-lg ring-1 ring-[#E0A43B]/50'
                        : 'border-[#F3EFE6]/15 opacity-50 hover:-translate-y-0.5 hover:opacity-85'
                    }`}
                  >
                    <PosterImage movieId={m.id} src={m.poster_url} title={m.title} year={m.release_year} size="xs" />
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
            <Link to="/catalog" className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center bg-[#D63628]">
                <Clapperboard className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-editorial text-xl font-bold">CineVault</span>
            </Link>
            <Link to="/catalog" className="text-xs text-[#A59F95] hover:text-[#F3EFE6]">
              Kho phim →
            </Link>
          </div>

          {/* Mode Tabs */}
          <div className="mb-7 flex border-b border-[#F3EFE6]/12">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 border-b-2 pb-3 text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'border-b-[#D63628] text-[#F3EFE6]'
                  : 'border-b-transparent text-[#746F67] hover:text-[#F3EFE6]'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 border-b-2 pb-3 text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'border-b-[#D63628] text-[#F3EFE6]'
                  : 'border-b-transparent text-[#746F67] hover:text-[#F3EFE6]'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>

          <h2 className="font-editorial text-3xl font-semibold text-[#F3EFE6]">
            {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản mới'}
          </h2>
          <p className="mt-1.5 text-sm text-[#A59F95]">
            {mode === 'login'
              ? 'Đăng nhập để quản lý danh sách phim yêu thích và viết đánh giá.'
              : 'Chỉ mất vài giây để bắt đầu lưu phim và chia sẻ cảm nhận của bạn.'}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 border border-[#E04848]/45 bg-[#E04848]/10 px-4 py-3 text-xs leading-relaxed text-[#F3EFE6]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-fullname" className="block text-xs font-medium text-[#A59F95]">
                  Họ và tên <span className="text-[#D63628]">*</span>
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
                  className="mt-1.5 w-full border border-[#F3EFE6]/16 bg-[#131317] px-3.5 py-2.5 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/55 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#A59F95]">
                Email <span className="text-[#D63628]">*</span>
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="email@domain.com"
                className="mt-1.5 w-full border border-[#F3EFE6]/16 bg-[#131317] px-3.5 py-2.5 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/55 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-[#A59F95]">
                Mật khẩu <span className="text-[#D63628]">*</span>
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
                  placeholder={mode === 'register' ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'}
                  className="w-full border border-[#F3EFE6]/16 bg-[#131317] py-2.5 pl-3.5 pr-10 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/55 focus:outline-none"
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
              className="mt-2 w-full bg-[#D63628] py-3 text-sm font-medium text-[#F3EFE6] transition-colors hover:bg-[#E54739] disabled:opacity-50"
            >
              {submitting ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
          </form>

          {/* Subtle Quick Account Switcher for Testing */}
          <div className="mt-8 border-t border-[#F3EFE6]/10 pt-5">
            <p className="text-xs text-[#746F67]">Đăng nhập nhanh tài khoản mẫu:</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fillDemo('admin')}
                className="border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2 text-xs text-[#F3EFE6] transition-colors hover:border-[#D63628] hover:bg-[#1B1B21]"
              >
                Tài khoản Quản trị
              </button>
              <button
                type="button"
                onClick={() => fillDemo('user')}
                className="border border-[#F3EFE6]/14 bg-[#131317] px-3 py-2 text-xs text-[#A59F95] transition-colors hover:border-[#F3EFE6]/45 hover:text-[#F3EFE6]"
              >
                Tài khoản Thành viên
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

import { useEffect, useState } from 'react';
import { Plus, X, Film, Play } from 'lucide-react';
import { PosterImage } from './PosterImage';
import { extractYouTubeId } from './TrailerModal';

const SUGGESTED_GENRES = [
  'Drama', 'Crime', 'Action', 'Sci-Fi', 'Thriller', 'Adventure',
  'Animation', 'Comedy', 'Romance', 'Mystery', 'Fantasy', 'Biography',
  'History', 'War', 'Horror', 'Music', 'Western', 'Family',
];

function TagInput({ id, label, values, onChange, placeholder, helperText, suggestions = [] }) {
  const [draft, setDraft] = useState('');

  const addTag = (raw) => {
    const cleaned = raw.trim();
    if (!cleaned) return;
    if (!values.some((v) => v.toLowerCase() === cleaned.toLowerCase())) {
      onChange([...values, cleaned]);
    }
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
        {label}
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border border-[#F3EFE6]/14 bg-[#0E0E12] px-2.5 py-2 focus-within:border-[#F3EFE6]/45">
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 border border-[#F3EFE6]/16 bg-[#1B1B21] px-2 py-0.5 text-xs text-[#F3EFE6]"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== tag))}
              aria-label={`Xóa ${tag}`}
              className="text-[#746F67] hover:text-[#E04848]"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft.trim() && addTag(draft)}
          placeholder={values.length === 0 ? placeholder : 'Thêm...'}
          className="min-w-[120px] flex-1 bg-transparent py-0.5 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:outline-none"
        />
        {draft.trim() && (
          <button
            type="button"
            onClick={() => addTag(draft)}
            aria-label="Thêm thẻ"
            className="inline-flex items-center gap-1 border border-[#F3EFE6]/20 px-2 py-0.5 text-[11px] text-[#F3EFE6] hover:bg-[#F3EFE6]/10"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Thêm
          </button>
        )}
      </div>
      {helperText && <p className="mt-1 text-[11px] text-[#746F67]">{helperText}</p>}
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions
            .filter((g) => !values.some((v) => v.toLowerCase() === g.toLowerCase()))
            .slice(0, 10)
            .map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => addTag(g)}
                className="border border-[#F3EFE6]/10 px-2 py-0.5 text-[11px] text-[#A59F95] transition-colors hover:border-[#F3EFE6]/30 hover:text-[#F3EFE6]"
              >
                + {g}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  title: '',
  original_title: '',
  release_year: new Date().getFullYear(),
  runtime_minutes: 120,
  certificate: 'PG-13',
  language: 'English',
  country: 'USA',
  poster_url: '',
  trailer_url: '',
  imdb_rating: '',
  overview: '',
  genres: ['Drama'],
  directors: [],
  cast: [],
};

export function MovieFormDrawer({ open, movie, saving, onSubmit, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (movie) {
      setForm({
        title: movie.title || '',
        original_title: movie.original_title || '',
        release_year: movie.release_year || new Date().getFullYear(),
        runtime_minutes: movie.runtime_minutes || 120,
        certificate: movie.certificate || '',
        language: movie.language || 'English',
        country: movie.country || 'International',
        poster_url: movie.poster_url || '',
        trailer_url: movie.trailer_url || '',
        imdb_rating: movie.imdb_rating ?? '',
        overview: movie.overview || '',
        genres: movie.genres || [],
        directors: movie.directors || [],
        cast: movie.cast || [],
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [open, movie]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, saving, onClose]);

  if (!open) return null;

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = 'Vui lòng nhập tên phim.';
    const year = Number(form.release_year);
    if (!Number.isInteger(year) || year < 1888 || year > 2100) {
      next.release_year = 'Năm phát hành phải là số nguyên từ 1888 đến 2100.';
    }
    const runtime = Number(form.runtime_minutes);
    if (!Number.isInteger(runtime) || runtime < 1 || runtime > 1000) {
      next.runtime_minutes = 'Thời lượng phải từ 1 đến 1000 phút.';
    }
    if (!form.genres || form.genres.length === 0) {
      next.genres = 'Cần chọn ít nhất một thể loại.';
    }
    if (form.imdb_rating !== '' && form.imdb_rating !== null) {
      const imdb = Number(form.imdb_rating);
      if (Number.isNaN(imdb) || imdb < 0 || imdb > 10) {
        next.imdb_rating = 'Điểm IMDb phải nằm trong khoảng 0.0 – 10.0.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      title: form.title.trim(),
      original_title: form.original_title.trim() || null,
      overview: form.overview.trim(),
      release_year: parseInt(form.release_year, 10),
      runtime_minutes: parseInt(form.runtime_minutes, 10),
      certificate: form.certificate.trim() || null,
      language: form.language.trim() || null,
      country: form.country.trim() || null,
      poster_url: form.poster_url.trim() || null,
      backdrop_url: form.poster_url.trim() || null,
      trailer_url: form.trailer_url.trim() || null,
      imdb_rating: form.imdb_rating === '' ? null : Number(form.imdb_rating),
      genres: form.genres,
      directors: form.directors,
      cast: form.cast,
    };
    onSubmit(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movie-drawer-title"
    >
      <div className="fixed inset-0" onClick={() => !saving && onClose()} />
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-[#F3EFE6]/14 bg-[#111115] shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#F3EFE6]/10 px-6 py-5">
          <div>
            <p className="text-xs text-[#A59F95]">
              {movie ? 'Chỉnh sửa thông tin phim' : 'Thêm phim mới vào danh mục'}
            </p>
            <h2 id="movie-drawer-title" className="font-editorial mt-0.5 text-2xl font-semibold text-[#F3EFE6]">
              {movie ? movie.title : 'Thêm phim mới'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng bảng biên tập"
            className="border border-[#F3EFE6]/14 p-2 text-[#A59F95] transition-colors hover:border-[#F3EFE6]/40 hover:text-[#F3EFE6]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form id="movie-editor-form" onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Top split: Live 2:3 Poster Preview + Core Identity */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <p className="mb-2 text-[11px] font-medium tracking-wider text-[#A59F95] uppercase">
                Xem trước Poster (2:3)
              </p>
              <PosterImage
                src={form.poster_url}
                title={form.title || 'Tác phẩm mới'}
                year={form.release_year}
              />
            </div>

            <div className="space-y-4 sm:col-span-8">
              <div>
                <label htmlFor="m-title" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                  Tên phim <span className="text-[#D63628]">*</span>
                </label>
                <input
                  id="m-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ví dụ: Past Lives"
                  className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2.5 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/50 focus:outline-none"
                />
                {errors.title && <p className="mt-1 text-xs text-[#E04848]">{errors.title}</p>}
              </div>

              <div>
                <label htmlFor="m-orig" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                  Tên gốc (nếu có)
                </label>
                <input
                  id="m-orig"
                  type="text"
                  value={form.original_title}
                  onChange={(e) => setForm({ ...form, original_title: e.target.value })}
                  placeholder="Ví dụ: 전생 / In the Mood for Love"
                  className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2.5 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="m-year" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                    Năm <span className="text-[#D63628]">*</span>
                  </label>
                  <input
                    id="m-year"
                    type="number"
                    min={1888}
                    max={2100}
                    required
                    value={form.release_year}
                    onChange={(e) => setForm({ ...form, release_year: e.target.value })}
                    className="font-mono-ledger mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2.5 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/50 focus:outline-none"
                  />
                  {errors.release_year && <p className="mt-1 text-[11px] text-[#E04848]">{errors.release_year}</p>}
                </div>

                <div>
                  <label htmlFor="m-runtime" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                    Phút <span className="text-[#D63628]">*</span>
                  </label>
                  <input
                    id="m-runtime"
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={form.runtime_minutes}
                    onChange={(e) => setForm({ ...form, runtime_minutes: e.target.value })}
                    className="font-mono-ledger mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2.5 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/50 focus:outline-none"
                  />
                  {errors.runtime_minutes && <p className="mt-1 text-[11px] text-[#E04848]">{errors.runtime_minutes}</p>}
                </div>

                <div>
                  <label htmlFor="m-cert" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                    Phân loại
                  </label>
                  <input
                    id="m-cert"
                    type="text"
                    value={form.certificate}
                    onChange={(e) => setForm({ ...form, certificate: e.target.value })}
                    placeholder="PG-13 / R"
                    className="font-mono-ledger mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2.5 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="m-lang" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                    Ngôn ngữ
                  </label>
                  <input
                    id="m-lang"
                    type="text"
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-country" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                    Quốc gia
                  </label>
                  <input
                    id="m-country"
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2 text-sm text-[#F3EFE6] focus:border-[#F3EFE6]/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-imdb" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                    IMDb (0-10)
                  </label>
                  <input
                    id="m-imdb"
                    type="number"
                    step="0.1"
                    min={0}
                    max={10}
                    value={form.imdb_rating}
                    onChange={(e) => setForm({ ...form, imdb_rating: e.target.value })}
                    placeholder="8.4"
                    className="font-mono-ledger mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/50 focus:outline-none"
                  />
                  {errors.imdb_rating && <p className="mt-1 text-[11px] text-[#E04848]">{errors.imdb_rating}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Media URLs */}
          <div className="grid grid-cols-1 gap-4 border-t border-[#F3EFE6]/10 pt-5 sm:grid-cols-2">
            <div>
              <label htmlFor="m-poster" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                URL Poster
              </label>
              <input
                id="m-poster"
                type="url"
                value={form.poster_url}
                onChange={(e) => setForm({ ...form, poster_url: e.target.value })}
                placeholder="https://m.media-amazon.com/images/..."
                className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/50 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="m-trailer" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
                URL Trailer (YouTube)
              </label>
              <input
                id="m-trailer"
                type="url"
                value={form.trailer_url}
                onChange={(e) => setForm({ ...form, trailer_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2 text-sm text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Live 16:9 YouTube Trailer Preview inside Admin Editor */}
          {extractYouTubeId(form.trailer_url) && (
            <div className="border border-[#F3EFE6]/12 bg-[#0C0C0F] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono-ledger text-[10px] tracking-[0.18em] text-[#E0A43B] uppercase">
                  <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                  Xem trước Trailer nhúng (16:9)
                </span>
                <span className="font-mono-ledger text-[10px] text-[#746F67]">
                  ID: {extractYouTubeId(form.trailer_url)}
                </span>
              </div>
              <div className="aspect-video w-full overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${extractYouTubeId(form.trailer_url)}?rel=0&modestbranding=1`}
                  title="Xem trước Trailer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
            </div>
          )}

          {/* Editorial Synopsis */}
          <div>
            <label htmlFor="m-overview" className="block text-xs font-medium tracking-wider text-[#A59F95] uppercase">
              Tóm tắt nội dung (Synopsis)
            </label>
            <textarea
              id="m-overview"
              rows={4}
              value={form.overview}
              onChange={(e) => setForm({ ...form, overview: e.target.value })}
              placeholder="Mô tả ngắn gọn bối cảnh, xung đột chính và tinh thần điện ảnh của tác phẩm..."
              className="mt-1.5 w-full border border-[#F3EFE6]/14 bg-[#0E0E12] px-3 py-2.5 text-sm leading-relaxed text-[#F3EFE6] placeholder:text-[#57534E] focus:border-[#F3EFE6]/50 focus:outline-none"
            />
          </div>

          {/* Taxonomy tags */}
          <div className="space-y-4 border-t border-[#F3EFE6]/10 pt-5">
            <div>
              <TagInput
                id="m-genres"
                label="Thể loại *"
                values={form.genres}
                onChange={(genres) => setForm({ ...form, genres })}
                placeholder="Nhập thể loại rồi nhấn Enter"
                helperText="Chọn nhanh từ gợi ý bên dưới hoặc nhập thêm thể loại mới."
                suggestions={SUGGESTED_GENRES}
              />
              {errors.genres && <p className="mt-1 text-xs text-[#E04848]">{errors.genres}</p>}
            </div>

            <TagInput
              id="m-directors"
              label="Đạo diễn"
              values={form.directors}
              onChange={(directors) => setForm({ ...form, directors })}
              placeholder="Ví dụ: Christopher Nolan, Denis Villeneuve"
              helperText="Nhấn Enter hoặc dấu phẩy để thêm từng đạo diễn."
            />

            <TagInput
              id="m-cast"
              label="Diễn viên chính"
              values={form.cast}
              onChange={(cast) => setForm({ ...form, cast })}
              placeholder="Ví dụ: Cillian Murphy, Emma Stone, Song Kang-ho"
              helperText="Nhấn Enter hoặc dấu phẩy để thêm từng diễn viên."
            />
          </div>
        </form>

        {/* Drawer Footer */}
        <div className="flex items-center justify-end border-t border-[#F3EFE6]/10 bg-[#0E0E12] px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="border border-[#F3EFE6]/16 px-4 py-2 text-xs font-medium tracking-wider text-[#A59F95] uppercase transition-colors hover:border-[#F3EFE6]/40 hover:text-[#F3EFE6]"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="movie-editor-form"
              disabled={saving}
              className="bg-[#D63628] px-5 py-2 text-xs font-semibold tracking-wider text-[#F3EFE6] uppercase transition-colors hover:bg-[#E54739] disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : movie ? 'Lưu thay đổi' : 'Xuất bản phim'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  Info,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  Star,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { PosterImage } from './PosterImage';

const SESSION_STORAGE_KEY = 'titofilm_concierge_sid';

const STARTER_PROMPTS = {
  vi: [
    'Phim hack não giống Inception',
    'Xem gọn dưới 100 phút, điểm cao',
    'Kiệt tác kinh điển thập niên 90',
    'Phim của đạo diễn Christopher Nolan',
  ],
  en: [
    'Mind-bending films similar to Inception',
    'Quick watch under 100 minutes, top rated',
    '1990s cinema classics',
    'Films directed by Christopher Nolan',
  ],
};

function generateSessionId() {
  return `tito-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Renders lightweight inline **bold** and clean bullet lines without raw markdown syntax.
 */
function FormattedReply({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, lineIdx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return null;
        const isBullet = /^[-*•]\s+/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^[-*•]\s+/, '') : trimmed;
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        const nodes = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-white">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={pIdx}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-0.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#E0A43B]" aria-hidden="true" />
              <p className="flex-1">{nodes}</p>
            </div>
          );
        }
        return <p key={lineIdx}>{nodes}</p>;
      })}
    </div>
  );
}

/**
 * Tito Concierge — Personal Film Curator widget for Titofilm.
 * Grounded strictly in Titofilm's real movie catalog, with persisted session history.
 */
export function TitoConciergeWidget({ onOpenDetail, onPlayTrailer, hidden = false }) {
  const { t, lang, formatRuntime } = useLanguage();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) return saved;
    const fresh = generateSessionId();
    localStorage.setItem(SESSION_STORAGE_KEY, fresh);
    return fresh;
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Restore persisted conversation history when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .assistantGetSession(sessionId)
      .then((res) => {
        if (!cancelled && res?.messages?.length && messages.length === 0) {
          setMessages(res.messages);
        }
      })
      .catch(() => {});
    window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open]);

  const sendMessage = async (rawText) => {
    const text = (rawText ?? input).trim();
    if (!text || sending) return;

    const userMsg = {
      role: 'user',
      content: text,
      movies: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await api.assistantChat({
        message: text,
        session_id: sessionId,
        lang: lang || 'vi',
      });
      if (res.session_id && res.session_id !== sessionId) {
        setSessionId(res.session_id);
        localStorage.setItem(SESSION_STORAGE_KEY, res.session_id);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          movies: res.movies || [],
          follow_ups: res.follow_up_suggestions || [],
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            lang === 'en'
              ? `Could not reach Tito Concierge (${err.message}). Please try again.`
              : `Không thể kết nối Tito Concierge (${err.message}). Bạn thử lại sau giây lát nhé.`,
          movies: [],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleReset = async () => {
    try {
      await api.assistantClearSession(sessionId);
    } catch {
      // noop
    }
    const fresh = generateSessionId();
    setSessionId(fresh);
    localStorage.setItem(SESSION_STORAGE_KEY, fresh);
    setMessages([]);
  };

  if (hidden && !open) return null;

  const starters = STARTER_PROMPTS[lang === 'en' ? 'en' : 'vi'];

  return (
    <>
      {/* Minimalist Floating Cinema Concierge Trigger */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mở Tito Concierge"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-full border border-white/18 bg-[#13131A]/92 px-4 py-2.5 text-xs font-medium text-[#F3EFE6] shadow-[0_14px_38px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all hover:border-white/45 hover:bg-[#191922]"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-[#E50914] font-editorial text-xs font-bold text-white">
            T
          </span>
          <span>{lang === 'en' ? 'Film Concierge' : 'Tư vấn phim'}</span>
          <MessageSquare className="h-3.5 w-3.5 text-[#8C877E]" aria-hidden="true" />
        </button>
      )}

      {/* Floating Cinema Concierge Panel */}
      {open && (
        <aside
          role="dialog"
          aria-label="Tito Concierge"
          className="fixed bottom-4 right-4 z-50 flex h-[min(680px,84dvh)] w-[calc(100vw-2rem)] max-w-[440px] flex-col overflow-hidden rounded-2xl border border-white/14 bg-[#111116]/96 shadow-[0_30px_90px_rgba(0,0,0,0.92)] backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#15151C] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#E50914] font-editorial text-sm font-bold text-white">
                T
              </span>
              <div>
                <h2 className="font-editorial text-base font-bold leading-tight text-white">
                  Tito Concierge
                </h2>
                <p className="text-[11px] text-[#8C877E]">
                  {lang === 'en' ? 'Personal Film Curator' : 'Trợ lý điện ảnh Titofilm'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  title={lang === 'en' ? 'New conversation' : 'Cuộc trò chuyện mới'}
                  aria-label="Làm mới hội thoại"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-[#8C877E] transition-colors hover:border-white/35 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-[#8C877E] transition-colors hover:border-white/35 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <p className="font-editorial text-xl font-semibold text-white">
                    {lang === 'en' ? 'What kind of film are you looking for?' : 'Bạn đang tìm bộ phim thế nào?'}
                  </p>
                  <p className="text-xs leading-relaxed text-[#8C877E]">
                    {lang === 'en'
                      ? 'Describe a mood, runtime, decade, director, or a film you loved to receive tailored picks.'
                      : 'Mô tả tự nhiên theo cảm xúc, thời lượng, thập kỷ, đạo diễn hoặc tên một bộ phim bạn yêu thích.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  {starters.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="block w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left text-xs text-[#D8D3C8] transition-colors hover:border-white/35 hover:bg-white/[0.07] hover:text-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-[#F3EFE6] font-medium text-[#0B0B0D]'
                          : 'border border-white/10 bg-[#181820] text-[#E2DDD4]'
                      }`}
                    >
                      {isUser ? <p>{msg.content}</p> : <FormattedReply text={msg.content} />}
                    </div>

                    {/* Curated Real Movie Cards */}
                    {!isUser && msg.movies?.length > 0 && (
                      <div className="mt-2.5 w-full space-y-2">
                        {msg.movies.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#16161D] p-2 transition-colors hover:border-white/28"
                          >
                            <button
                              type="button"
                              onClick={() => onOpenDetail(m)}
                              className="w-11 shrink-0 overflow-hidden rounded-md"
                            >
                              <PosterImage
                                movieId={m.id}
                                src={m.poster_url}
                                title={m.title}
                                year={m.release_year}
                                size="xs"
                                className="border-0"
                              />
                            </button>

                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => onOpenDetail(m)}
                                className="w-full text-left"
                              >
                                <p className="font-editorial truncate text-sm font-semibold text-white hover:underline">
                                  {m.title}
                                </p>
                              </button>
                              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono-ledger text-[10px] text-[#8C877E]">
                                <span className="inline-flex items-center gap-0.5 font-semibold text-[#E0A43B]">
                                  <Star className="h-2.5 w-2.5 fill-[#E0A43B]" aria-hidden="true" />
                                  {m.avg_rating.toFixed(1)}
                                </span>
                                {m.imdb_rating && <span>IMDb {m.imdb_rating.toFixed(1)}</span>}
                                <span>·</span>
                                <span>{m.release_year}</span>
                                <span>·</span>
                                <span>{formatRuntime(m.runtime_minutes)}</span>
                              </p>
                              {m.directors?.[0] && (
                                <p className="truncate text-[10px] text-[#746F67]">{m.directors[0]}</p>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => onPlayTrailer(m, e)}
                                aria-label={`${t('watchTrailer')} ${m.title}`}
                                title={t('watchTrailer')}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3EFE6] text-[#0B0B0D] transition-colors hover:bg-white"
                              >
                                <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenDetail(m)}
                                aria-label={`${t('detailsShort')} ${m.title}`}
                                title={t('detailsShort')}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-[#C9C3B8] hover:border-white hover:text-white"
                              >
                                <Info className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Follow-up Suggestions on latest assistant turn */}
                    {!isUser && idx === messages.length - 1 && msg.follow_ups?.length > 0 && !sending && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.follow_ups.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => sendMessage(sug)}
                            className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-[#A59F95] transition-colors hover:border-white/35 hover:text-white"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-[#8C877E]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#E50914]" />
                <span>{lang === 'en' ? 'Curating recommendations...' : 'Đang tìm phim phù hợp...'}</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 border-t border-white/10 bg-[#14141B] p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                lang === 'en'
                  ? 'Ask for a mood, film, runtime, director...'
                  : 'Hỏi theo tâm trạng, thời lượng, đạo diễn...'
              }
              className="flex-1 rounded-full border border-white/14 bg-[#0D0D12] px-4 py-2 text-xs text-white placeholder:text-[#6B665E] focus:border-white/45 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Gửi"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3EFE6] text-[#0B0B0D] transition-colors hover:bg-white disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}

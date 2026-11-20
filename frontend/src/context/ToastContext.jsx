import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ title, description, variant = 'info', actionLabel, onAction, duration = 4500 }) => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant, actionLabel, onAction }]);
      if (duration > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
      return id;
    },
    []
  );

  return (
    <ToastContext.Provider value={{ pushToast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const Icon =
            t.variant === 'success'
              ? CheckCircle2
              : t.variant === 'danger'
                ? AlertTriangle
                : Info;
          const accentClass =
            t.variant === 'success'
              ? 'border-l-[#3DA86E] text-[#3DA86E]'
              : t.variant === 'danger'
                ? 'border-l-[#E04848] text-[#E04848]'
                : 'border-l-[#E0A43B] text-[#E0A43B]';

          return (
            <div
              key={t.id}
              role="status"
              className={`flex items-start gap-3 border border-[#F3EFE6]/12 border-l-2 bg-[#16161C] px-4 py-3.5 shadow-2xl ${accentClass}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1 text-[#F3EFE6]">
                <p className="text-sm font-medium leading-snug">{t.title}</p>
                {t.description && (
                  <p className="mt-1 text-xs leading-relaxed text-[#A59F95]">{t.description}</p>
                )}
                {t.actionLabel && t.onAction && (
                  <button
                    type="button"
                    onClick={() => {
                      t.onAction();
                      dismiss(t.id);
                    }}
                    className="mt-2 inline-flex items-center border border-[#F3EFE6]/25 px-2.5 py-1 text-xs font-medium tracking-wide text-[#F3EFE6] transition-colors hover:border-[#F3EFE6] hover:bg-[#F3EFE6]/10"
                  >
                    {t.actionLabel}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Đóng thông báo"
                className="text-[#746F67] transition-colors hover:text-[#F3EFE6]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

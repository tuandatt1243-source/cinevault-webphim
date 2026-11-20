import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy bỏ',
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md border border-[#F3EFE6]/16 bg-[#131317] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border ${
                variant === 'danger'
                  ? 'border-[#E04848]/30 bg-[#E04848]/10 text-[#E04848]'
                  : 'border-[#E0A43B]/30 bg-[#E0A43B]/10 text-[#E0A43B]'
              }`}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="confirm-dialog-title" className="font-editorial text-xl font-semibold text-[#F3EFE6]">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#A59F95]">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Đóng hộp thoại"
            className="text-[#746F67] transition-colors hover:text-[#F3EFE6]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#F3EFE6]/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="border border-[#F3EFE6]/16 px-4 py-2 text-xs font-medium tracking-wider text-[#A59F95] uppercase transition-colors hover:border-[#F3EFE6]/40 hover:text-[#F3EFE6]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-colors disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-[#D63628] text-[#F3EFE6] hover:bg-[#E54739]'
                : 'bg-[#F3EFE6] text-[#0B0B0D] hover:bg-white'
            }`}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

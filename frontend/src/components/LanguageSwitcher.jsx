import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export function LanguageSwitcher({ compact = false, align = 'right' }) {
  const { lang, setLang, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const current = languages.find((l) => l.code === lang) || languages[0];

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Chọn ngôn ngữ hiển thị"
        className="inline-flex items-center gap-1.5 border border-[#F3EFE6]/16 bg-[#131317] px-2.5 py-1.5 text-xs text-[#F3EFE6] transition-colors hover:border-[#F3EFE6]/45"
      >
        <Globe className="h-3.5 w-3.5 text-[#A59F95]" aria-hidden="true" />
        <span className="font-mono-ledger font-medium">{compact ? current.short : current.label}</span>
        <ChevronDown className="h-3 w-3 text-[#746F67]" aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Danh sách ngôn ngữ"
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} z-[80] mt-1.5 w-40 rounded-lg border border-[#F3EFE6]/18 bg-[#141418] py-1 shadow-[0_20px_50px_rgba(0,0,0,0.85)]`}
        >
          {languages.map((item) => {
            const active = item.code === lang;
            return (
              <li key={item.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLang(item.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    active
                      ? 'bg-[#1D1D24] font-medium text-[#F3EFE6]'
                      : 'text-[#A59F95] hover:bg-[#191920] hover:text-[#F3EFE6]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono-ledger text-[10px] text-[#746F67]">{item.short}</span>
                    {active && <Check className="h-3.5 w-3.5 text-[#D63628]" aria-hidden="true" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

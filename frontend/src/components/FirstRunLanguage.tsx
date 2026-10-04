import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGS, storedLang } from '../i18n';
import { LogoMark } from './Logo';

/** First-run language selection with large native-script buttons (section 9). */
export function FirstRunLanguage() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(() => storedLang() === null);
  const firstBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstBtn.current?.focus();
  }, [open]);

  if (!open) return null;
  const choose = (code: string) => {
    void i18n.changeLanguage(code);
    setOpen(false);
  };
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-green-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-title"
    >
      <div className="card w-full max-w-md p-6 text-center">
        <LogoMark className="mx-auto h-14 w-14" />
        <h2 id="lang-title" className="mt-3 text-xl font-bold">
          மொழி • भाषा • Language
        </h2>
        <p className="muted mt-1 text-sm">Choose your language</p>
        <div className="mt-5 grid gap-3">
          {LANGS.map((l, i) => (
            <button
              key={l.code}
              ref={i === 0 ? firstBtn : undefined}
              lang={l.code}
              onClick={() => choose(l.code)}
              className="flex min-h-[64px] items-center justify-between rounded-2xl border-2 border-green-100 bg-green-50 px-5 text-left transition-colors hover:border-green-600 hover:bg-green-100"
            >
              <span className="text-2xl font-bold text-green-900">{l.native}</span>
              <span className="text-sm text-slate-600">{l.english}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

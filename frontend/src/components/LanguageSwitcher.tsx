import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGS } from '../i18n';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t('lang.label')}
      className="flex items-center gap-1 rounded-xl bg-green-100 p-1"
    >
      {!compact && <Languages className="mx-1 hidden h-4 w-4 text-green-900 sm:block" aria-hidden />}
      {LANGS.map((l) => {
        const active = i18n.language === l.code;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={active}
            lang={l.code}
            onClick={() => void i18n.changeLanguage(l.code)}
            className={`min-h-[40px] rounded-lg px-2.5 text-sm font-semibold transition-colors ${
              active ? 'bg-green-700 text-white shadow-soft' : 'text-green-900 hover:bg-white'
            }`}
          >
            {compact && l.code === 'en' ? 'EN' : l.native}
          </button>
        );
      })}
    </div>
  );
}

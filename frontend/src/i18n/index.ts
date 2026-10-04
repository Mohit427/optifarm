import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import ta from './ta';
import hi from './hi';
import type { Lang } from '../lib/types';
import { storage } from '../lib/storage';

export const LANGS: { code: Lang; native: string; english: string }[] = [
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'en', native: 'English', english: 'English' },
];

const LANG_KEY = 'kl.lang';

export const storedLang = (): Lang | null => {
  const v = storage.get<string>(LANG_KEY);
  return v === 'en' || v === 'ta' || v === 'hi' ? v : null;
};

export const BCP47: Record<Lang, string> = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ta: { translation: ta }, hi: { translation: hi } },
  lng: storedLang() ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

const applyHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
};
applyHtmlLang(i18n.language);
i18n.on('languageChanged', (lng) => {
  storage.set(LANG_KEY, lng);
  applyHtmlLang(lng);
});

export const currentLang = (): Lang => (['en', 'ta', 'hi'].includes(i18n.language) ? (i18n.language as Lang) : 'en');

export default i18n;

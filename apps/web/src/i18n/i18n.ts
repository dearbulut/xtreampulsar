import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './tr.json';
import en from './en.json';
import de from './de.json';
import ar from './ar.json';

const savedLang = localStorage.getItem('xp-lang') ?? 'tr';

void i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
    de: { translation: de },
    ar: { translation: ar },
  },
  lng: savedLang,
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
});

export default i18n;

export const LANGUAGES = [
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

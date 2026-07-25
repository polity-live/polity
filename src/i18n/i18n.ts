import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resources from './locales';

i18n
  // Integriert i18next mit React
  .use(initReactI18next)
  // Initialisiert i18next
  .init({
    resources,
    // Keep the initial client snapshot identical to SSR. The language store
    // applies the persisted or browser language after hydration.
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React escapes values already
    },
  });

export default i18n;
export type Language = 'en' | 'de';

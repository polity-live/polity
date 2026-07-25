import type { Language } from '@/features/shared/global-state/language.store';

const PENDING_GOOGLE_LANGUAGE_KEY = 'polity_pending_google_language';

export function normalizeAuthLanguage(value: unknown): Language {
  return value === 'de' ? 'de' : 'en';
}

export function storePendingGoogleLanguage(language: Language) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_GOOGLE_LANGUAGE_KEY, language);
}

export function consumePendingGoogleLanguage(): Language | null {
  if (typeof window === 'undefined') return null;

  const value = window.sessionStorage.getItem(PENDING_GOOGLE_LANGUAGE_KEY);
  window.sessionStorage.removeItem(PENDING_GOOGLE_LANGUAGE_KEY);
  return value === 'de' || value === 'en' ? value : null;
}

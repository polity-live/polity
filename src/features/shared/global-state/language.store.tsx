import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'de';

const DEFAULT_LANGUAGE: Language = 'en';
const LANGUAGE_STORAGE_KEY = 'language-storage';
const LANGUAGE_STORAGE_VERSION = 1;

/**
 * Detect the browser's preferred language.
 * Maps 'de' variants to 'de', everything else to 'en'.
 * Only English and German translations exist — extendable by adding to this mapping.
 */
function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const browserLang = navigator.language || '';
  return browserLang.startsWith('de') ? 'de' : 'en';
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'de';
}

function getPersistedLanguage(value: unknown): Language | null {
  if (!value || typeof value !== 'object') return null;
  const language = (value as { language?: unknown }).language;
  return isLanguage(language) ? language : null;
}

function readPersistedLanguage(): Language | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedValue = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!storedValue) return null;

    const parsed = JSON.parse(storedValue) as {
      state?: unknown;
      version?: unknown;
    };

    return parsed.version === LANGUAGE_STORAGE_VERSION ? getPersistedLanguage(parsed.state) : null;
  } catch {
    return null;
  }
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    set => ({
      // The initial snapshot must match the server-rendered English markup.
      language: DEFAULT_LANGUAGE,
      setLanguage: (language: Language) => set({ language }),
    }),
    {
      name: LANGUAGE_STORAGE_KEY,
      version: LANGUAGE_STORAGE_VERSION,
      skipHydration: true,
      partialize: state => ({ language: state.language }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        language: getPersistedLanguage(persistedState) ?? currentState.language,
      }),
      migrate: () => ({
        language: DEFAULT_LANGUAGE,
      }),
    }
  )
);

/**
 * Hydrate language preferences after React has attached to the server markup.
 * A valid saved preference wins; otherwise use the browser language.
 */
export async function hydrateLanguageStore(): Promise<void> {
  if (typeof window === 'undefined') return;

  const persistedLanguage = readPersistedLanguage();
  await useLanguageStore.persist.rehydrate();
  const language = persistedLanguage ?? detectBrowserLanguage();

  if (useLanguageStore.getState().language !== language) {
    useLanguageStore.getState().setLanguage(language);
  }
}

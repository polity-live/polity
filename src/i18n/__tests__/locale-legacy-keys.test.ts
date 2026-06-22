import { describe, expect, it } from 'vitest';

import deTranslation from '@/i18n/locales/de/deTranslation';
import enTranslation from '@/i18n/locales/en/enTranslation';

const locales = {
  de: deTranslation,
  en: enTranslation,
} as const;

function hasOwnKey(target: object, key: string) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

describe('locale legacy root keys', () => {
  it.each(Object.entries(locales))('%s does not expose legacy timeline aliases', (_, locale) => {
    expect(hasOwnKey(locale, 'home')).toBe(false);
    expect(hasOwnKey(locale, 'timeline')).toBe(false);
    expect(locale.features.timeline.terminal.indicationShort).toBe('Ind');
  });
});

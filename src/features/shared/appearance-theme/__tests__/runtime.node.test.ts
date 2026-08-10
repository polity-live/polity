import { expect, it } from 'vitest';

import { POLITY_THEME } from '../presets';
import { applyAppearanceTheme, applyThemeMetadata } from '../runtime';

it('does not access browser globals during server rendering', () => {
  expect(() => applyAppearanceTheme(POLITY_THEME)).not.toThrow();
  expect(() => applyThemeMetadata(false, POLITY_THEME)).not.toThrow();
});

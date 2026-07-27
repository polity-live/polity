import { describe, expect, it } from 'vitest';
import {
  appearanceThemeDefinitionSchema,
  BUILTIN_THEMES,
  buildThemeCss,
  contrastRatio,
  themeFontsSchema,
  POLITY_THEME,
  validateThemeForPublishing,
} from '..';

describe('appearance theme contract', () => {
  it('ships seven valid, WCAG-AA preset themes', () => {
    expect(BUILTIN_THEMES).toHaveLength(7);
    for (const theme of BUILTIN_THEMES) {
      expect(appearanceThemeDefinitionSchema.safeParse(theme).success).toBe(true);
      expect(validateThemeForPublishing(theme)).toEqual([]);
    }
  });

  it('gives every organization preset distinct surfaces in both modes', () => {
    const expectedSurfaces = {
      spd: ['#FFF5F5', '#F7E3E6', '#E6BEC5', '#17090C', '#32171D', '#53303A'],
      cdu: ['#F3F8F9', '#E1EEF0', '#BFD8DC', '#091318', '#183039', '#29464E'],
      fdp: ['#F4F7FC', '#E3EAF5', '#C2CEE0', '#071224', '#152945', '#294665'],
      gruene: ['#F4F8F2', '#E3EDDE', '#C5D5BC', '#07140D', '#183021', '#2C4936'],
      linke: ['#FFF5F8', '#F2E1E8', '#DFBCCB', '#190810', '#361824', '#533041'],
      volt: ['#F8F5FC', '#EDE4F5', '#D5C3E2', '#130A1C', '#311B41', '#4B315C'],
    };

    for (const theme of BUILTIN_THEMES.slice(1)) {
      expect([
        theme.light.background,
        theme.light.secondary,
        theme.light.border,
        theme.dark.background,
        theme.dark.secondary,
        theme.dark.border,
      ]).toEqual(expectedSurfaces[theme.slug as keyof typeof expectedSurfaces]);
      expect(theme.light.background).not.toBe(POLITY_THEME.light.background);
      expect(theme.light.card).not.toBe(POLITY_THEME.light.card);
      expect(theme.dark.background).not.toBe(POLITY_THEME.dark.background);
      expect(theme.dark.card).not.toBe(POLITY_THEME.dark.card);
      expect({
        lightSuccess: theme.light.success,
        lightDestructive: theme.light.destructive,
        darkSuccess: theme.dark.success,
        darkDestructive: theme.dark.destructive,
      }).toEqual({
        lightSuccess: POLITY_THEME.light.success,
        lightDestructive: POLITY_THEME.light.destructive,
        darkSuccess: POLITY_THEME.dark.success,
        darkDestructive: POLITY_THEME.dark.destructive,
      });
    }
  });

  it('detects insufficient body contrast', () => {
    const theme = structuredClone(POLITY_THEME);
    theme.light.foreground = theme.light.background;
    const issues = validateThemeForPublishing(theme);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'foreground', pairedWith: 'background' }),
      ])
    );
  });

  it('calculates the standard black-on-white contrast ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
  });

  it('accepts only bundled fonts from the whitelist', () => {
    expect(
      themeFontsSchema.safeParse({
        display: 'https://fonts.example/custom.woff2',
        sans: 'manrope',
        mono: 'jetbrains-mono',
      }).success
    ).toBe(false);
  });

  it('serializes both modes and fonts into runtime CSS', () => {
    const css = buildThemeCss(POLITY_THEME);
    expect(css).toContain(':root{');
    expect(css).toContain(':root.dark{');
    expect(css).toContain('--font-display-family');
    expect(css).toContain('--badge-success-bg');
    expect(css).toContain('--entity-group-gradient');
    expect(css).toContain('--primary:#12362D');
    expect(css).toContain('--background:#07110E');
  });
});

/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { PolityLoadingScreen } from '../PolityLoadingScreen';
import { StudioLoadingScreen } from '@/features/communication-studio/ui/StudioLoadingScreen';
import { studioShow as de } from '@/i18n/locales/de/features/studioShow';
import { studioShow as en } from '@/i18n/locales/en/features/studioShow';
afterEach(cleanup);
it('announces loading with a localized label through the shared and Studio screens', () => {
  const view = render(<PolityLoadingScreen label="Preparing" />);
  expect(screen.getByRole('status').textContent).toContain('Preparing');
  expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
  view.rerender(<StudioLoadingScreen label="Vorbereiten" fullPage />);
  expect(screen.getByRole('status').textContent).toContain('Vorbereiten');
  expect(screen.getByRole('status').classList.contains('polity-presentation-loading-page')).toBe(
    true
  );
});
it('keeps German and English presentation copy complete for every show control', () => {
  expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  for (const copy of [de, en])
    for (const value of Object.values(copy)) expect(value.trim()).not.toBe('');
});

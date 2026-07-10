/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataViewAttribution } from '../DataViewAttribution';

afterEach(cleanup);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'de-DE' },
    t: (key: string, options?: Record<string, unknown>) =>
      key === 'plateJs.dataView.source'
        ? 'Quelle'
        : key === 'plateJs.dataView.dataAsOf'
          ? `Datenstand ${options?.date}`
          : key,
  }),
}));

describe('DataViewAttribution', () => {
  it('shows the group and localized upload date without an external link', () => {
    render(
      <DataViewAttribution
        source={{
          provider: 'UPLOAD',
          publisher: 'Beispielgruppe',
          sourceUrl: null,
          snapshotTakenAt: '2026-07-10T12:00:00.000Z',
        }}
      />
    );

    expect(screen.getByTestId('data-view-attribution').textContent).toBe(
      'Quelle: Beispielgruppe · Datenstand 10.07.2026'
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('adds the provider and links external sources without duplicate labels', () => {
    const { rerender } = render(
      <DataViewAttribution
        source={{
          provider: 'GOVDATA',
          publisher: 'Wissenschaftsstadt Darmstadt',
          sourceUrl: 'https://example.test/data.csv',
          snapshotTakenAt: '2026-04-20T00:00:00.000Z',
        }}
      />
    );

    expect(screen.getByRole('link').textContent).toBe('Wissenschaftsstadt Darmstadt (GovData)');
    expect(screen.getByTestId('data-view-attribution').textContent).toContain(
      'Datenstand 20.04.2026'
    );

    rerender(
      <DataViewAttribution
        source={{
          provider: 'EUROSTAT',
          publisher: 'Eurostat',
          sourceUrl: 'https://example.test/eurostat',
          snapshotTakenAt: '2026-04-20T00:00:00.000Z',
        }}
      />
    );
    expect(screen.getByRole('link').textContent).toBe('Eurostat');
  });
});

/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ forceInvalidBuilder: false }));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T,>(initial: T) => {
      const state = actual.useState(initial);
      if (!mocks.forceInvalidBuilder) return state;
      if (initial === 'find') return ['build', state[1]] as typeof state;
      if (initial === null) return [null, state[1]] as typeof state;
      return state;
    },
  };
});

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) => key,
    tArray: (key: string) => (key.endsWith('areaLabels') ? ['A', 'B', 'C', 'D', 'E', 'F'] : []),
  }),
}));

import { LandingOfficialDataPreview } from '../LandingOfficialDataPreview';

beforeEach(() => {
  mocks.forceInvalidBuilder = false;
});

afterEach(cleanup);

describe('LandingOfficialDataPreview branch campaign A07', () => {
  it('covers translation fallbacks, provider removal/addition, empty search, and sum preview', () => {
    const { container } = render(<LandingOfficialDataPreview />);
    const results = screen.getAllByTestId('landing-dataset-result');
    expect(results).toHaveLength(4);
    expect(results[0].textContent).toContain('eurostat');

    const providerButtons = container.querySelectorAll<HTMLButtonElement>(
      '[data-action-id="public-landing.official-data.provider.toggle"]'
    );
    fireEvent.click(providerButtons[0]);
    expect(screen.getAllByTestId('landing-dataset-result')).toHaveLength(3);
    fireEvent.click(providerButtons[0]);
    expect(screen.getAllByTestId('landing-dataset-result')).toHaveLength(4);

    fireEvent.click(providerButtons[3]);
    fireEvent.click(
      container.querySelector('[data-action-id="public-landing.official-data.sample-csv.select"]')!
    );
    expect(screen.getByTestId('landing-dataset-details')).toBeTruthy();

    fireEvent.change(
      container.querySelector('[data-action-id="public-landing.official-data.search.change"]')!,
      { target: { value: 'definitely absent' } }
    );
    expect(screen.queryAllByTestId('landing-dataset-result')).toHaveLength(0);
    fireEvent.change(
      container.querySelector('[data-action-id="public-landing.official-data.search.change"]')!,
      { target: { value: '' } }
    );
    fireEvent.click(screen.getAllByTestId('landing-dataset-result')[0]);
    fireEvent.click(
      container.querySelector('[data-action-id="public-landing.official-data.dataset.use"]')!
    );
    expect(screen.getByTestId('landing-data-builder')).toBeTruthy();

    fireEvent.click(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '[data-action-id="public-landing.official-data.view.select"]'
        )
      )[2]
    );
    fireEvent.change(
      container.querySelector(
        '[data-action-id="public-landing.official-data.aggregation.select"]'
      )!,
      { target: { value: 'sum' } }
    );
    expect(screen.getByTestId('landing-data-stat-preview').textContent).toContain('324');

    fireEvent.click(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '[data-action-id="public-landing.official-data.view.select"]'
        )
      )[0]
    );
    fireEvent.change(
      container.querySelector('[data-action-id="public-landing.official-data.dimension.select"]')!,
      { target: { value: 'area' } }
    );
    fireEvent.click(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '[data-action-id="public-landing.official-data.view.select"]'
        )
      )[1]
    );
    expect(screen.getByText('F')).toBeTruthy();
  });

  it('renders defensive empty attribution for an externally restored invalid builder state', () => {
    mocks.forceInvalidBuilder = true;
    render(<LandingOfficialDataPreview />);
    expect(screen.getByTestId('landing-data-builder')).toBeTruthy();
    expect(screen.getByTestId('landing-data-attribution')).toBeTruthy();
  });
});

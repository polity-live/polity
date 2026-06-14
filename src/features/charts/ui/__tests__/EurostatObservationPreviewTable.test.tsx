/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { EurostatDimension } from '../../types';
import { EurostatObservationPreviewTable } from '../EurostatObservationPreviewTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const dimensions: EurostatDimension[] = [
  {
    id: 'geo',
    label: 'Geography',
    position: 0,
    values: [{ id: 'DE', label: 'Germany' }],
  },
  {
    id: 'unit',
    label: 'Unit',
    position: 1,
    values: [{ id: 'PC_GDP' }],
  },
];

describe('EurostatObservationPreviewTable', () => {
  it('renders exactly the first five observations with ID and label values', () => {
    render(
      <EurostatObservationPreviewTable
        dimensions={dimensions}
        rows={Array.from({ length: 6 }, (_, index) => ({
          id: `row-${index}`,
          value: 100 + index,
          dimensions: { geo: 'DE', unit: 'PC_GDP' },
          attributes: index === 0 ? { OBS_STATUS: 'A' } : {},
        }))}
      />
    );

    expect(screen.getAllByTestId('eurostat-observation-preview-row')).toHaveLength(5);
    expect(screen.getAllByText('DE · Germany').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PC_GDP').length).toBeGreaterThan(0);
    expect(screen.getByText('OBS_STATUS: A')).toBeTruthy();
    expect(screen.queryByText('105')).toBeNull();
  });
});

/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CityDesignCostSummary } from '../../types';
import { StreetCostSummaryView } from '../StreetCostSummaryView';

afterEach(cleanup);

const empty: CityDesignCostSummary = {
  currency: 'EUR',
  totalCostMinor: 0,
  categories: [],
  lines: [],
};

const fractional: CityDesignCostSummary = {
  currency: 'EUR',
  totalCostMinor: 250,
  categories: [{ category: 'mobility', quantity: 1.5, totalCostMinor: 250 }],
  lines: [
    {
      objectId: 'path',
      type: 'sidewalk',
      labelKey: 'features.amendments.cityDesign.objects.sidewalk.label',
      category: 'mobility',
      rule: 'per_meter',
      quantity: 1.5,
      unitCostMinor: 100,
      totalCostMinor: 150,
      currency: 'EUR',
    },
    {
      objectId: 'path-2',
      type: 'bike_lane',
      labelKey: 'features.amendments.cityDesign.objects.bikeLane.label',
      category: 'mobility',
      rule: 'per_meter',
      quantity: 1,
      unitCostMinor: 100,
      totalCostMinor: 100,
      currency: 'EUR',
    },
  ],
};

describe('StreetCostSummaryView A04 alternatives', () => {
  it('renders panel, empty, and hidden-comparison states', () => {
    render(
      <StreetCostSummaryView
        summary={empty}
        comparisonMode="original"
        showComparisonControls={false}
        variant="panel"
        onComparisonModeChange={vi.fn()}
      />
    );
    expect(screen.getByText(/no cost categories/i)).toBeTruthy();
    expect(screen.getByText(/no elements yet/i)).toBeTruthy();
    expect(screen.queryByText(/comparison/i)).toBeNull();
  });

  it('renders selected fractional rows and closes an open category', () => {
    render(
      <StreetCostSummaryView
        summary={fractional}
        comparisonMode="split"
        selectedObjectId="path"
        readOnly
        onComparisonModeChange={vi.fn()}
        onDeleteObject={vi.fn()}
        onDeleteObjectCategory={vi.fn()}
      />
    );
    const toggle = screen.getByRole('button', { name: /expand mobility/i });
    fireEvent.click(toggle);
    expect(screen.getByText(/1.5 x/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /collapse mobility/i }));
  });

  it('allows absent optional selection callbacks', () => {
    render(
      <StreetCostSummaryView
        summary={fractional}
        comparisonMode="new_design"
        onComparisonModeChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /select mobility/i }));
  });
});

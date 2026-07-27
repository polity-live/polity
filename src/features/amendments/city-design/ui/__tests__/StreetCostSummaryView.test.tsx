/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CityDesignCostSummary } from '../../types';
import { StreetCostSummaryView } from '../StreetCostSummaryView';

function summary(): CityDesignCostSummary {
  return {
    currency: 'EUR',
    totalCostMinor: 45_000,
    categories: [{ category: 'greenery', quantity: 1, totalCostMinor: 45_000 }],
    lines: [
      {
        objectId: 'tree-1',
        type: 'tree',
        labelKey: 'features.amendments.cityDesign.objects.tree.label',
        category: 'greenery',
        rule: 'per_item',
        quantity: 1,
        unitCostMinor: 45_000,
        totalCostMinor: 45_000,
        currency: 'EUR',
      },
    ],
  };
}

describe('StreetCostSummaryView', () => {
  afterEach(() => {
    cleanup();
  });

  it('can delete an object from a cost row', () => {
    const onDeleteObject = vi.fn();

    render(
      <StreetCostSummaryView
        summary={summary()}
        comparisonMode="overlay"
        onComparisonModeChange={vi.fn()}
        onDeleteObject={onDeleteObject}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand Greenery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Tree' }));

    expect(onDeleteObject).toHaveBeenCalledWith('tree-1');
  });

  it('can select an added element from the cost list', () => {
    const onObjectSelect = vi.fn();

    render(
      <StreetCostSummaryView
        summary={summary()}
        comparisonMode="overlay"
        selectedObjectId={null}
        onComparisonModeChange={vi.fn()}
        onObjectSelect={onObjectSelect}
        onDeleteObject={vi.fn()}
      />
    );

    expect(screen.getByText('Cost breakdown')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand Greenery' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Greenery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Tree' }));

    expect(onObjectSelect).toHaveBeenCalledWith('tree-1');
  });

  it('can delete a grouped cost category', () => {
    const onDeleteObjectCategory = vi.fn();

    render(
      <StreetCostSummaryView
        summary={summary()}
        comparisonMode="overlay"
        onComparisonModeChange={vi.fn()}
        onDeleteObject={vi.fn()}
        onDeleteObjectCategory={onDeleteObjectCategory}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Greenery' }));

    expect(onDeleteObjectCategory).toHaveBeenCalledWith('greenery');
  });

  it('moves comparison mode from the toolbar into the cost area', () => {
    const onComparisonModeChange = vi.fn();

    render(
      <StreetCostSummaryView
        summary={summary()}
        comparisonMode="overlay"
        onComparisonModeChange={onComparisonModeChange}
        onDeleteObject={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /new design/i }));

    expect(onComparisonModeChange).toHaveBeenCalledWith('new_design');
  });
});

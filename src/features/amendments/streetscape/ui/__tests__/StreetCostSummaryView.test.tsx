/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StreetDesignCostSummary } from '../../types';
import { StreetCostSummaryView } from '../StreetCostSummaryView';

function summary(): StreetDesignCostSummary {
  return {
    currency: 'EUR',
    totalCostMinor: 45_000,
    categories: [{ category: 'greenery', quantity: 1, totalCostMinor: 45_000 }],
    lines: [
      {
        objectId: 'tree-1',
        type: 'tree',
        label: 'Baum',
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
  it('can delete an object from a cost row', () => {
    const onDeleteObject = vi.fn();

    render(<StreetCostSummaryView summary={summary()} onDeleteObject={onDeleteObject} />);
    fireEvent.click(screen.getByTitle('Element loeschen'));

    expect(onDeleteObject).toHaveBeenCalledWith('tree-1');
  });
});

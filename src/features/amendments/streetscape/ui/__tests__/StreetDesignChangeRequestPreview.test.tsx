/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logic/streetDesignScene', () => ({
  mountStreetDesignScene: vi.fn().mockResolvedValue({ dispose: vi.fn() }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'features.amendments.streetscape.changeRequests.before': 'Before',
        'features.amendments.streetscape.changeRequests.after': 'After',
        'features.amendments.streetscape.inspector.price': 'Price',
        'features.amendments.streetscape.inspector.total': 'Total',
      })[key] ?? key,
  }),
}));

import {
  getStreetDesignChangeRequestStreetDesignId,
  isStreetDesignChangeRequest,
} from '../../logic/streetDesignChangeRequests';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import {
  resolveStreetDesignPreviewState,
  StreetDesignChangeRequestPreview,
} from '../StreetDesignChangeRequestPreview';

afterEach(cleanup);

describe('StreetDesignChangeRequestPreview helpers', () => {
  it('recognizes street design source types and snapshot street design ids', () => {
    const changeRequest = {
      id: 'cr-1',
      source_type: 'street_design_scene',
      source_id: 'street-design-source',
      new_properties: { streetDesignId: 'street-design-snapshot' },
    };

    expect(isStreetDesignChangeRequest(changeRequest)).toBe(true);
    expect(getStreetDesignChangeRequestStreetDesignId(changeRequest)).toBe(
      'street-design-snapshot'
    );
  });

  it('uses the matching street design state before falling back to the first design', () => {
    const firstDesign = createEmptyStreetDesignState({
      lat: 1,
      lon: 1,
      label: 'First design',
    });
    const matchingDesign = createEmptyStreetDesignState({
      lat: 2,
      lon: 2,
      label: 'Matching design',
    });

    const resolved = resolveStreetDesignPreviewState(
      {
        id: 'cr-1',
        source_type: 'street_design_object',
        source_id: 'building-1',
        change_type: 'insert',
        new_properties: { streetDesignId: 'street-design-2' },
      },
      [
        { id: 'street-design-1', design_state: firstDesign },
        { id: 'street-design-2', design_state: matchingDesign },
      ]
    );

    expect(resolved.origin.label).toBe('Matching design');
  });

  it('shows before and after costs for a price-only event CR', () => {
    const streetObject = (customUnitCostMinor: number) => ({
      id: 'tree-1',
      type: 'tree',
      geometry: { kind: 'point', point: { x: 0, z: 0 }, rotation: 0 },
      properties: {},
      cost: {
        rule: 'per_item',
        currency: 'EUR',
        suggestedUnitCostMinor: 10_000,
        customUnitCostMinor,
      },
    });

    render(
      <StreetDesignChangeRequestPreview
        changeRequest={{
          id: 'cr-price',
          source_type: 'street_design_object',
          source_id: 'tree-1',
          change_type: 'update',
          original_properties: { object: streetObject(10_000) },
          new_properties: { object: streetObject(12_345) },
        }}
      />
    );

    expect(screen.getByText('Before')).toBeTruthy();
    expect(screen.getByText('After')).toBeTruthy();
    expect(screen.getAllByText(/Price:/)).toHaveLength(2);
    expect(screen.getAllByText(/Total:/)).toHaveLength(2);
    expect(screen.getAllByText(/123[,.]45/).length).toBeGreaterThan(0);
  });
});

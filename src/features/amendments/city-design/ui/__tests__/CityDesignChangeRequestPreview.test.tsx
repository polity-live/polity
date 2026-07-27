/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logic/cityDesignScene', () => ({
  mountCityDesignScene: vi.fn().mockResolvedValue({ dispose: vi.fn() }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'features.amendments.cityDesign.changeRequests.before': 'Before',
        'features.amendments.cityDesign.changeRequests.after': 'After',
        'features.amendments.cityDesign.inspector.price': 'Price',
        'features.amendments.cityDesign.inspector.total': 'Total',
      })[key] ?? key,
  }),
}));

import {
  getCityDesignChangeRequestCityDesignId,
  isCityDesignChangeRequest,
} from '../../logic/cityDesignChangeRequests';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  resolveCityDesignPreviewState,
  CityDesignChangeRequestPreview,
} from '../CityDesignChangeRequestPreview';

afterEach(cleanup);

describe('CityDesignChangeRequestPreview helpers', () => {
  it('recognizes city design source types and snapshot city design ids', () => {
    const changeRequest = {
      id: 'cr-1',
      source_type: 'city_design_scene',
      source_id: 'city-design-source',
      new_properties: { cityDesignId: 'city-design-snapshot' },
    };

    expect(isCityDesignChangeRequest(changeRequest)).toBe(true);
    expect(getCityDesignChangeRequestCityDesignId(changeRequest)).toBe('city-design-snapshot');
  });

  it('uses the matching city design state before falling back to the first design', () => {
    const firstDesign = createEmptyCityDesignState({
      lat: 1,
      lon: 1,
      label: 'First design',
    });
    const matchingDesign = createEmptyCityDesignState({
      lat: 2,
      lon: 2,
      label: 'Matching design',
    });

    const resolved = resolveCityDesignPreviewState(
      {
        id: 'cr-1',
        source_type: 'city_design_object',
        source_id: 'building-1',
        change_type: 'insert',
        new_properties: { cityDesignId: 'city-design-2' },
      },
      [
        { id: 'city-design-1', design_state: firstDesign },
        { id: 'city-design-2', design_state: matchingDesign },
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
      <CityDesignChangeRequestPreview
        changeRequest={{
          id: 'cr-price',
          source_type: 'city_design_object',
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

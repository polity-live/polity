import { describe, expect, it } from 'vitest';

import { getCityDesignVariantLabelKey } from '../cityDesignVariantCatalog';

describe('city design variant label lookup LSF contract', () => {
  it('executes every type-specific lookup adapter', () => {
    const types = [
      'bike_lane',
      'building',
      'bus_stop',
      'car_lane',
      'civic_area',
      'construction_area',
      'crossing',
      'fountain',
      'landuse_context_area',
      'loading_zone',
      'parking_area',
      'playground',
      'rail_track',
      'sidewalk',
      'sports_pitch',
      'station_platform',
      'street',
      'traffic_calming',
      'traffic_signal',
      'tree',
      'water_area',
      'wetland_area',
    ] as const;

    for (const type of types) {
      expect(getCityDesignVariantLabelKey(type, {})).toMatch(/^features\.amendments\.cityDesign\./);
    }
  });
});

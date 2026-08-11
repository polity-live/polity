import { describe, expect, it } from 'vitest';
import { getCityDesignVariantLabelKey } from '../cityDesignVariantCatalog';

const label = (
  type: Parameters<typeof getCityDesignVariantLabelKey>[0],
  properties: Parameters<typeof getCityDesignVariantLabelKey>[1]
) => getCityDesignVariantLabelKey(type, properties);

describe('cityDesignVariantCatalog A04 alternatives', () => {
  it('normalizes tree aliases and rejects unknown variants', () => {
    expect(label('tree', { species: 'obstbaum' })).toContain('.fruit');
    expect(label('tree', { species: 'zierkirsche' })).toContain('.ornamental_cherry');
    expect(label('tree', { species: 'japanese_cherry' })).toContain('.ornamental_cherry');
    expect(label('tree', { species: 'pflaume' })).toContain('.flowering_plum');
    expect(label('tree', { species: 'plum' })).toContain('.flowering_plum');
    expect(label('tree', { species: 'native' })).toContain('.deciduous');
    expect(label('tree', { species: 'unknown-tree' })).toBeNull();
  });

  it('labels bridge and non-bridge mobility variants', () => {
    expect(label('bike_lane', { structureKind: 'bridge' })).toContain('.bridge');
    expect(label('bike_lane', { protection: 'protected' })).toContain('.protected');
    expect(label('car_lane', { structureKind: 'bridge' })).toContain('.bridge');
    expect(label('car_lane', { direction: 'two_way' })).toContain('.two_way');
    expect(label('sidewalk', { structureKind: 'bridge' })).toContain('.bridge');
    expect(label('sidewalk', { pathType: 'promenade' })).toContain('.promenade');
  });

  it('distinguishes sheltered and unsheltered bus stops', () => {
    expect(label('bus_stop', { shelter: false })).toContain('.bus_stop');
    expect(label('bus_stop', { shelter: true })).toContain('.sheltered_bus_stop');
  });

  it('labels bridge, viaduct, and ordinary rail tracks', () => {
    expect(label('rail_track', { structureKind: 'bridge' })).toContain('.bridge');
    expect(label('rail_track', { structureKind: 'viaduct' })).toContain('.viaduct');
    expect(label('rail_track', { railType: 'light_rail' })).toContain('.light_rail');
  });

  it('covers every platform elevation, shelter, and type decision', () => {
    expect(
      label('station_platform', {
        platformType: 'bus_platform',
        deckElevationMeters: 2,
        shelter: true,
      })
    ).toContain('.elevated_sheltered_bus_stop');
    expect(
      label('station_platform', {
        platformType: 'rail_platform',
        deckElevationMeters: 2,
        shelter: true,
      })
    ).toContain('.elevated_sheltered_rail_stop');
    expect(
      label('station_platform', {
        platformType: 'rail_platform',
        deckElevationMeters: Number.NaN,
        shelter: false,
      })
    ).toContain('.rail_platform');
    expect(
      label('station_platform', {
        platformType: 'bus_platform',
        deckElevationMeters: 0,
        shelter: false,
      })
    ).toContain('.bus_platform');
    expect(label('station_platform', { platformType: 'tram_stop' })).toContain('.tram_platform');
  });

  it('labels bridge, construction, and ordinary streets', () => {
    expect(label('street', { structureKind: 'bridge' })).toContain('.bridge');
    expect(label('street', { status: 'construction' })).toContain('.construction');
    expect(label('street', { roadClass: 'living_street' })).toContain('.living_street');
  });
});

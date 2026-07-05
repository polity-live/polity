import { describe, expect, it } from 'vitest';
import type { StreetDesignGeoPoint, StreetDesignOrigin } from '../../types';
import { projectGeoPointToLocal, unprojectLocalPointToGeo } from '../streetDesignProjection';

const origin: StreetDesignOrigin = {
  lat: 48.1397,
  lon: 11.5197,
  label: 'Euckenstrasse',
};

describe('streetDesignProjection', () => {
  it('maps north to negative local z and south to positive local z', () => {
    const north = projectGeoPointToLocal({ lat: origin.lat + 0.0001, lon: origin.lon }, origin);
    const south = projectGeoPointToLocal({ lat: origin.lat - 0.0001, lon: origin.lon }, origin);

    expect(north.z).toBeLessThan(0);
    expect(south.z).toBeGreaterThan(0);
  });

  it('keeps east on positive local x', () => {
    const east = projectGeoPointToLocal({ lat: origin.lat, lon: origin.lon + 0.0001 }, origin);
    const west = projectGeoPointToLocal({ lat: origin.lat, lon: origin.lon - 0.0001 }, origin);

    expect(east.x).toBeGreaterThan(0);
    expect(west.x).toBeLessThan(0);
  });

  it('round-trips projected points back to geographic coordinates', () => {
    const point: StreetDesignGeoPoint = {
      lat: 48.140142,
      lon: 11.521039,
    };

    const projected = projectGeoPointToLocal(point, origin);
    const unprojected = unprojectLocalPointToGeo(projected, origin);

    expect(unprojected.lat).toBeCloseTo(point.lat, 8);
    expect(unprojected.lon).toBeCloseTo(point.lon, 8);
  });
});

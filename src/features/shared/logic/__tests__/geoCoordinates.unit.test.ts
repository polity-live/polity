import { describe, expect, it } from 'vitest';

import { geoCoordinatesEqual, hasGeoCoordinates, toGeoCoordinates } from '../geoCoordinates';

describe('geo coordinate helpers', () => {
  it('accepts only finite numeric latitude and longitude pairs', () => {
    expect(hasGeoCoordinates({ latitude: 52.5, longitude: 13.4 })).toBe(true);
    expect(hasGeoCoordinates(null)).toBe(false);
    expect(hasGeoCoordinates({ latitude: Number.NaN, longitude: 13.4 })).toBe(false);
    expect(hasGeoCoordinates({ latitude: 52.5 })).toBe(false);
    expect(hasGeoCoordinates({ latitude: 52.5, longitude: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('converts finite lat/lon pairs and rejects every incomplete or invalid pair', () => {
    expect(toGeoCoordinates({ lat: 52.5, lon: 13.4 })).toEqual({
      latitude: 52.5,
      longitude: 13.4,
    });
    expect(toGeoCoordinates(undefined)).toBeNull();
    expect(toGeoCoordinates({ lat: Number.NaN, lon: 13.4 })).toBeNull();
    expect(toGeoCoordinates({ lat: 52.5 })).toBeNull();
    expect(toGeoCoordinates({ lat: 52.5, lon: Number.NEGATIVE_INFINITY })).toBeNull();
  });

  it('compares absent and rounded coordinate pairs at configurable precision', () => {
    expect(geoCoordinatesEqual(null, null)).toBe(true);
    expect(geoCoordinatesEqual(null, { latitude: 1, longitude: 2 })).toBe(false);
    expect(
      geoCoordinatesEqual(
        { latitude: 52.5000001, longitude: 13.4000001 },
        { latitude: 52.5000002, longitude: 13.4000002 }
      )
    ).toBe(true);
    expect(
      geoCoordinatesEqual(
        { latitude: 52.5, longitude: 13.4 },
        { latitude: 52.5, longitude: 13.5 },
        2
      )
    ).toBe(false);
    expect(
      geoCoordinatesEqual(
        { latitude: 52.5, longitude: 13.4 },
        { latitude: 52.6, longitude: 13.4 },
        2
      )
    ).toBe(false);
  });
});

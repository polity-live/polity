import { describe, expect, it } from 'vitest';
import { getCityDesignOriginFromAmendmentLocation } from '../cityDesignAmendmentLocation';

describe('cityDesignAmendmentLocation', () => {
  it('returns null when the amendment has no complete coordinates', () => {
    expect(
      getCityDesignOriginFromAmendmentLocation({
        title: 'Safer crossing',
        latitude: 52.52,
        longitude: null,
      })
    ).toBeNull();
  });

  it('creates an origin from amendment coordinates and formatted address', () => {
    expect(
      getCityDesignOriginFromAmendmentLocation({
        title: 'Safer crossing',
        country: 'Germany',
        post_code: '10115',
        city: 'Berlin',
        street: 'Invalidenstrasse',
        latitude: 52.531,
        longitude: 13.384,
      })
    ).toEqual({
      lat: 52.531,
      lon: 13.384,
      label: 'Invalidenstrasse, 10115 Berlin, Germany',
    });
  });

  it('falls back to the amendment title when no address parts are set', () => {
    expect(
      getCityDesignOriginFromAmendmentLocation({
        title: 'Safer crossing',
        latitude: 52.531,
        longitude: 13.384,
      })
    ).toEqual({
      lat: 52.531,
      lon: 13.384,
      label: 'Safer crossing',
    });
  });
});

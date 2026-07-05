import { describe, expect, it } from 'vitest';
import { getStreetDesignOriginFromAmendmentLocation } from '../streetDesignAmendmentLocation';

describe('streetDesignAmendmentLocation', () => {
  it('returns null when the amendment has no complete coordinates', () => {
    expect(
      getStreetDesignOriginFromAmendmentLocation({
        title: 'Safer crossing',
        latitude: 52.52,
        longitude: null,
      })
    ).toBeNull();
  });

  it('creates an origin from amendment coordinates and formatted address', () => {
    expect(
      getStreetDesignOriginFromAmendmentLocation({
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
      getStreetDesignOriginFromAmendmentLocation({
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

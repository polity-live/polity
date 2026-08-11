import { describe, expect, it } from 'vitest';
import { getCityDesignOriginFromAmendmentLocation } from '../cityDesignAmendmentLocation';

describe('cityDesignAmendmentLocation A04 alternatives', () => {
  it('handles absent amendments and omits empty labels', () => {
    expect(getCityDesignOriginFromAmendmentLocation()).toBeNull();
    expect(
      getCityDesignOriginFromAmendmentLocation({
        title: '   ',
        latitude: 0,
        longitude: 0,
      })
    ).toEqual({ lat: 0, lon: 0 });
  });
});

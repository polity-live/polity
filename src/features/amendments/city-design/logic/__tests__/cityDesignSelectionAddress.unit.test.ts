import { describe, expect, it } from 'vitest';
import {
  createCityDesignSelectionAddress,
  formatCityDesignSelectionAddress,
  mapCityDesignSelectionAddressToValues,
} from '../cityDesignSelectionAddress';

describe('cityDesignSelectionAddress', () => {
  it('keeps the resolved and entered address fields for persistence', () => {
    const address = createCityDesignSelectionAddress(
      {
        place_id: 'place-1',
        formatted: 'Alexanderplatz 1, 10178 Berlin, Germany',
        lat: 52.5219,
        lon: 13.4132,
      },
      {
        country: 'Germany',
        region: 'Berlin',
        city: 'Berlin',
        post_code: '10178',
        street: 'Alexanderplatz',
        house_number: '1',
      }
    );

    expect(address).toEqual({
      placeId: 'place-1',
      formatted: 'Alexanderplatz 1, 10178 Berlin, Germany',
      country: 'Germany',
      region: 'Berlin',
      city: 'Berlin',
      postCode: '10178',
      street: 'Alexanderplatz',
      houseNumber: '1',
    });
    expect(mapCityDesignSelectionAddressToValues(address)).toEqual({
      country: 'Germany',
      region: 'Berlin',
      city: 'Berlin',
      post_code: '10178',
      street: 'Alexanderplatz',
      house_number: '1',
    });
  });

  it('prefers freshly resolved fields over a stale controlled-input snapshot', () => {
    const address = createCityDesignSelectionAddress(
      {
        place_id: 'street-1',
        formatted: 'Euckenstraße, 81369 München, Deutschland',
        country: 'Deutschland',
        state: 'Bayern',
        city: 'München',
        postcode: '81369',
        street: 'Euckenstraße',
        lat: 48.13956,
        lon: 11.51946,
      },
      {
        country: 'Deutschland',
        region: 'Bayern',
        city: 'München',
        post_code: '',
        street: '',
        house_number: '',
      }
    );

    expect(address).toMatchObject({
      postCode: '81369',
      street: 'Euckenstraße',
    });
  });

  it('falls back from structured address to origin label and coordinates', () => {
    const center = { lat: 52.52, lon: 13.405 };

    expect(
      formatCityDesignSelectionAddress(
        { street: 'Invalidenstraße', houseNumber: '117', city: 'Berlin' },
        null,
        center
      )
    ).toBe('Invalidenstraße 117, Berlin');
    expect(formatCityDesignSelectionAddress(undefined, 'Berlin Mitte', center)).toBe(
      'Berlin Mitte'
    );
    expect(formatCityDesignSelectionAddress(undefined, null, center)).toBe('52.52000, 13.40500');
  });
});

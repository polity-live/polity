import { describe, expect, it } from 'vitest';
import {
  createStreetDesignSelectionAddress,
  formatStreetDesignSelectionAddress,
  mapStreetDesignSelectionAddressToValues,
} from '../streetDesignSelectionAddress';

describe('streetDesignSelectionAddress', () => {
  it('keeps the resolved and entered address fields for persistence', () => {
    const address = createStreetDesignSelectionAddress(
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
    expect(mapStreetDesignSelectionAddressToValues(address)).toEqual({
      country: 'Germany',
      region: 'Berlin',
      city: 'Berlin',
      post_code: '10178',
      street: 'Alexanderplatz',
      house_number: '1',
    });
  });

  it('falls back from structured address to origin label and coordinates', () => {
    const center = { lat: 52.52, lon: 13.405 };

    expect(
      formatStreetDesignSelectionAddress(
        { street: 'Invalidenstraße', houseNumber: '117', city: 'Berlin' },
        null,
        center
      )
    ).toBe('Invalidenstraße 117, Berlin');
    expect(formatStreetDesignSelectionAddress(undefined, 'Berlin Mitte', center)).toBe(
      'Berlin Mitte'
    );
    expect(formatStreetDesignSelectionAddress(undefined, null, center)).toBe('52.52000, 13.40500');
  });
});

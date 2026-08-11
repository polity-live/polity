import { describe, expect, it } from 'vitest';

import {
  buildLocationSearchValue,
  formatLocation,
  formatNamedLocation,
  hasLocationParts,
} from '../locationHelpers';

describe('location helpers', () => {
  it('handles absent and whitespace-only locations', () => {
    expect(hasLocationParts()).toBe(false);
    expect(hasLocationParts({ city: '  ' })).toBe(false);
    expect(formatLocation(null)).toBe('');
    expect(buildLocationSearchValue(undefined)).toBe('');
  });

  it('formats normalized address parts and searchable text', () => {
    const location = {
      street: ' Main Street ',
      house_number: ' 5 ',
      post_code: ' 10115 ',
      city: ' Berlin ',
      region: ' Berlin ',
      country: ' Germany ',
    };

    expect(hasLocationParts(location)).toBe(true);
    expect(formatLocation(location)).toBe('Main Street 5, 10115 Berlin, Berlin, Germany');
    expect(formatNamedLocation(' City Hall ', location)).toBe(
      'City Hall, Main Street 5, 10115 Berlin, Berlin, Germany'
    );
    expect(buildLocationSearchValue(location)).toBe('germany berlin 10115 berlin main street 5');
  });

  it('formats a name without an address', () => {
    expect(formatNamedLocation(' Venue ', null)).toBe('Venue');
    expect(formatNamedLocation(null, null)).toBe('');
  });
});

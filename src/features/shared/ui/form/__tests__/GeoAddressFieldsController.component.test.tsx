/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GeoResolvedAddress } from '../GeoAddressInputField';
import { useGeoAddressFieldsController } from '../useGeoAddressFieldsController';

const emptyValues = {
  country: '',
  region: '',
  city: '',
  post_code: '',
  street: '',
  house_number: '',
};

const labels = {
  country: 'Country',
  region: 'Region',
  city: 'City',
  post_code: 'Post code',
  street: 'Street',
  house_number: 'House number',
};

const cityResult: GeoResolvedAddress = {
  place_id: 'city-1',
  city: 'Berlin',
  lat: 52.52,
  lon: 13.405,
};

afterEach(cleanup);

describe('useGeoAddressFieldsController', () => {
  it('does not re-emit the same resolved address when the parent callback identity changes', async () => {
    const onResolvedAddress = vi.fn();

    function Harness() {
      const [emissionCount, setEmissionCount] = useState(0);
      const controller = useGeoAddressFieldsController({
        idPrefix: 'location',
        values: emptyValues,
        onFieldChange: vi.fn(),
        labels,
        placeholders: labels,
        onResolvedAddress: (result, field) => {
          onResolvedAddress(result, field);
          setEmissionCount(count => count + 1);
        },
      });

      useEffect(() => {
        controller.handleResolved('city', cityResult);
      }, [controller.handleResolved]);

      return <div data-testid="emission-count">{emissionCount}</div>;
    }

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('emission-count').textContent).toBe('2');
    });

    expect(onResolvedAddress).toHaveBeenCalledTimes(2);
    expect(onResolvedAddress).toHaveBeenNthCalledWith(1, null, null);
    expect(onResolvedAddress).toHaveBeenNthCalledWith(2, cityResult, 'city');
  });
});

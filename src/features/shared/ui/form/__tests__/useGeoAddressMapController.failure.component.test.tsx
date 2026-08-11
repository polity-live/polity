// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => {
  throw new Error('map bundle unavailable');
});

vi.mock('leaflet', () => ({ divIcon: vi.fn() }));

import { useGeoAddressMapController } from '../useGeoAddressMapController';

it('marks a live dynamic map import failure', async () => {
  const { result } = renderHook(() =>
    useGeoAddressMapController({
      coordinates: null,
      onCoordinatesChange: vi.fn(),
      loadingLabel: 'Loading',
      unavailableLabel: 'Unavailable',
      busyLabel: 'Busy',
      emptyMessage: 'Empty',
      moveHint: 'Move',
    })
  );

  await waitFor(() => expect(result.current.loadFailed).toBe(true));
});

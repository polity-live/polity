// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  let rejectModule!: (reason: unknown) => void;
  const failedModule = new Promise<never>((_resolve, reject) => {
    rejectModule = reject;
  });
  return { failedModule, rejectModule };
});

vi.mock('react-leaflet', async () => mocks.failedModule);
vi.mock('leaflet', () => ({ divIcon: vi.fn() }));

import { useGeoAddressMapController } from '../useGeoAddressMapController';

it('ignores a dynamic map import failure after unmount', async () => {
  const hook = renderHook(() =>
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
  hook.unmount();
  await act(async () => mocks.rejectModule(new Error('late module failure')));
  expect(hook.result.current.loadFailed).toBe(false);
});

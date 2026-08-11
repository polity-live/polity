/* @vitest-environment jsdom */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => {
  throw new Error('map module unavailable');
});
vi.mock('leaflet', () => ({ divIcon: vi.fn() }));

import { useSupporterLocalityMapController } from '../useSupporterLocalityMapController';

describe('useSupporterLocalityMapController failed module loading', () => {
  afterEach(() => cleanup());

  it('reports a module load failure while active', async () => {
    const { result } = renderHook(() => useSupporterLocalityMapController([]));
    await waitFor(() => expect(result.current.loadFailed).toBe(true));
  });

  it('ignores a module load failure after unmount', () => {
    const hook = renderHook(() => useSupporterLocalityMapController([]));
    hook.unmount();
  });
});

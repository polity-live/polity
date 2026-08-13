/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ features: [] as any[], convert: vi.fn() }));
vi.mock('../../logic/cityDesignOsm', async importOriginal => ({
  ...(await importOriginal<typeof import('../../logic/cityDesignOsm')>()),
  getCityDesignOsmFeatures: () => mocks.features,
}));
vi.mock('../../logic/cityDesignOsmConversion', () => ({
  convertCityDesignOsmFeature: (...args: unknown[]) => mocks.convert(...args),
}));
vi.mock('../../logic/cityDesignCosting', () => ({
  getCityDesignCostLine: (object: any) => ({ objectId: object.id }),
  getCityDesignCostSummary: () => ({ totalMinor: 0 }),
}));

import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import { useCityDesignEditorState } from '../useCityDesignEditorState';

afterEach(cleanup);

describe('useCityDesignEditorState A04 branch accountability', () => {
  it('handles absent and present OSM imports and selected object costs', () => {
    const object = {
      id: 'object',
      type: 'tree',
      geometry: { kind: 'point', point: { x: 0, z: 0 } },
      properties: {},
      visible: true,
    } as any;
    const design = { ...createEmptyCityDesignState(), objects: [object] };
    mocks.features = [{ id: 'way' }];
    mocks.convert.mockReset().mockReturnValue([]);
    const { result } = renderHook(() => useCityDesignEditorState(design));

    expect(result.current.selectedObjectCostLine).toBeNull();
    act(() => result.current.selectObject('object'));
    expect(result.current.selectedObjectCostLine).toEqual({ objectId: 'object' });
    act(() => {
      result.current.importOsmWay('missing');
      result.current.importOsmWay('way');
    });
    expect(mocks.convert).toHaveBeenCalledOnce();
  });
});

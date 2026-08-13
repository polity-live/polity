/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  features: [{ id: 'osm-way' }],
  convert: vi.fn((_feature: unknown) => []),
}));

vi.mock('../../logic/cityDesignOsm', async importOriginal => ({
  ...(await importOriginal<typeof import('../../logic/cityDesignOsm')>()),
  getCityDesignOsmFeatures: () => mocks.features,
}));
vi.mock('../../logic/cityDesignOsmConversion', () => ({
  convertCityDesignOsmFeature: (feature: unknown) => mocks.convert(feature),
}));
vi.mock('../../logic/cityDesignCosting', async importOriginal => ({
  ...(await importOriginal<typeof import('../../logic/cityDesignCosting')>()),
  getCityDesignCostLine: (object: { id: string }) => ({ objectId: object.id }),
  getCityDesignCostSummary: () => ({ totalMinor: 0 }),
}));

import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import { useCityDesignEditorState } from '../useCityDesignEditorState';

afterEach(cleanup);

describe('useCityDesignEditorState LSF action contract', () => {
  it('executes every public editor action adapter', () => {
    const object = {
      id: 'object-1',
      type: 'tree',
      geometry: { kind: 'point', point: { x: 0, z: 0 } },
      properties: {},
      visible: true,
    } as const;
    const initial = { ...createEmptyCityDesignState(), objects: [object] } as any;
    const { result } = renderHook(() => useCityDesignEditorState(initial));
    const selection = {
      center: { lat: 52.5, lon: 13.4 },
      radiusMeters: 250,
      bbox: { south: 52.4, west: 13.3, north: 52.6, east: 13.5 },
    } as any;

    act(() => {
      result.current.replaceDesign(initial, true);
      result.current.updateMapContext(selection, { city: 'Berlin' } as any, false);
      result.current.updateSelectionAddress({ city: 'Berlin' } as any);
      result.current.setComparisonMode('side-by-side' as any);
      result.current.setInteractionMode('edit' as any);
      result.current.setSelectedTool('tree', { species: 'oak' }, 4);
      result.current.setOsmLayerVisibility('road', false);
      result.current.setShowStreetMarkings(false);
      result.current.updatePlacementProperty('species', 'oak');
      result.current.updatePlacementWidth(5);
      result.current.updatePlacementRotation(45);
      result.current.updatePlacementUnitCost(100);
      result.current.handleScenePointerDown({ x: 1, z: 2 });
      result.current.handleScenePointerMove({ x: 2, z: 3 });
      result.current.finishPlacement();
      result.current.finishPathPlacement();
      result.current.cancelPlacement();
      result.current.selectObject('object-1');
      result.current.selectOsmWay('osm-way');
      result.current.setObjectVisibility('object-1', false);
      result.current.setObjectCategoryVisibility('nature' as any, false);
      result.current.hideOsmWay('osm-way');
      result.current.importOsmWay('osm-way');
      result.current.undoOsmImport('osm-way');
      result.current.updateObjectProperty('object-1', 'species', 'lime');
      result.current.updateObjectWidth('object-1', 3);
      result.current.rotateObject('object-1', 90);
      result.current.updateObjectUnitCost('object-1', 200);
      result.current.deleteObject('object-1');
      result.current.deleteObjectCategory('nature' as any);
    });

    expect(mocks.convert).toHaveBeenCalledOnce();
  });
});

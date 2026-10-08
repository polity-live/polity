/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useCityDesignMeasurements } from '../useCityDesignMeasurements';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  createCorridorCityDesignObject,
  createPolygonGeometry,
} from '../../logic/cityDesignPlacement';
import type { CityDesignSceneController } from '../../logic/cityDesignScene';
import type { CityDesignComparisonMode } from '../../types';

it('isolates additive selections and measurement endpoints across layers, visibility and comparison modes', () => {
  const road = createCorridorCityDesignObject({
    id: 'road',
    type: 'street',
    start: { x: -10, z: 0 },
    end: { x: 10, z: 0 },
    width: 6,
  });
  const polygon = {
    ...road,
    id: 'polygon',
    geometry: createPolygonGeometry([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ]),
  };
  const base = { ...createEmptyCityDesignState(), objects: [road, polygon] };
  const onObjectSelect = vi.fn(),
    onOsmWaySelect = vi.fn();
  const ground = vi.fn(() => ({ x: 3, z: 4 }));
  const sceneControllerRef = { current: null as CityDesignSceneController | null };
  const { result, rerender } = renderHook(
    ({
      mode,
      selected,
      osm,
      hidden,
      categories,
    }: {
      mode: CityDesignComparisonMode;
      selected: string | null;
      osm: string | null;
      hidden: string[];
      categories: 'street'[];
    }) =>
      useCityDesignMeasurements({
        design: { ...base, comparisonMode: mode },
        selectedObjectId: selected,
        selectedOsmWayId: osm,
        onObjectSelect,
        onOsmWaySelect,
        hiddenObjectIds: hidden,
        hiddenObjectCategories: categories,
        sceneControllerRef,
      }),
    {
      initialProps: {
        mode: 'overlay' as CityDesignComparisonMode,
        selected: null as string | null,
        osm: null as string | null,
        hidden: [] as string[],
        categories: [] as 'street'[],
      },
    }
  );
  act(() => result.current.moveEndpoint('start', 1, 2));
  act(() => result.current.selectObject('road'));
  act(() => result.current.selectObject('road', true));
  expect(result.current.selection).toEqual([]);
  expect(onObjectSelect).toHaveBeenLastCalledWith(null);
  expect(onOsmWaySelect).toHaveBeenLastCalledWith(null);
  act(() => result.current.selectObject('polygon'));
  expect(result.current.selectedWidths).toEqual([]);
  act(() => result.current.selectOsm('osm-road', true));
  expect(result.current.selectedObjectIds).toEqual([]);
  expect(result.current.selectedOsmWayIds).toEqual(['osm-road']);
  expect(onOsmWaySelect).toHaveBeenLastCalledWith('osm-road');
  act(() => result.current.selectOsm(null));
  rerender({ mode: 'overlay', selected: 'road', osm: null, hidden: [], categories: [] });
  expect(result.current.selectedWidths[0].width).toBe(6);
  rerender({ mode: 'overlay', selected: 'road', osm: null, hidden: ['road'], categories: [] });
  expect(result.current.selectedWidths).toEqual([]);
  rerender({
    mode: 'original',
    selected: null,
    osm: 'osm-road',
    hidden: [],
    categories: ['street'],
  });
  act(() => result.current.setMeasurementLevel(result.current.levels[0] ?? 'surface'));
  act(() => result.current.onMeasurementPoint({ x: 0, z: -10 }, 'design'));
  expect(result.current.measurement?.layer).toBe('original');
  act(() => result.current.moveEndpoint('start', 1, 2));
  expect(result.current.measurement?.start).toEqual({ x: 0, z: -10 });
  sceneControllerRef.current = {
    getGroundPointAtClient: ground,
  } as unknown as CityDesignSceneController;
  act(() => result.current.moveEndpoint('end', 20, 30));
  expect(ground).toHaveBeenLastCalledWith(20, 30, 'original');
  expect(result.current.measurement?.end).toEqual({ x: 3, z: 4 });
  act(() => result.current.setMeasurementLevel('bridge'));
  expect(result.current.measurement?.level).toBe('bridge');
  rerender({ mode: 'new_design', selected: null, osm: null, hidden: [], categories: [] });
  expect(result.current.measurement).toBeNull();
  act(() => result.current.setMeasurementLevel(result.current.levels[0] ?? 'surface'));
  act(() => result.current.onMeasurementPoint({ x: 0, z: -10 }, 'original'));
  act(() => result.current.onMeasurementPoint({ x: 0, z: 10 }, 'original'));
  expect(result.current.measurement?.layer).toBe('design');
  expect(result.current.measurementResult?.covered).toBeGreaterThan(0);
  act(() => result.current.setMeasurementLayer('design'));
  act(() => result.current.setMeasurementLayer('original'));
  expect(result.current.measurementLevel).toBeUndefined();
  act(() => result.current.clearMeasurement());
  expect(result.current.awaitingEnd).toBe(false);
});

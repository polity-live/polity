import { describe, expect, it } from 'vitest';

import {
  createCorridorCityDesignObject,
  createPointCityDesignObject,
} from '../../logic/cityDesignPlacement';
import {
  cityDesignReducer,
  createEmptyCityDesignState,
  createInitialCityDesignEditorState,
} from '../cityDesignReducer';

describe('cityDesignReducer A04 priority branches', () => {
  it('replaces the OSM snapshot and resets OSM selections', () => {
    const state = {
      ...createInitialCityDesignEditorState(),
      selectedOsmWayId: 'way-1',
      selectedObjectFocusRequestKey: 4,
      selectedOsmFocusRequestKey: 5,
    };
    const origin = { lat: 52.51, lon: 13.4, label: 'Test area' };
    const osmSnapshot = {
      fetchedAt: 123,
      bbox: { south: 52.5, west: 13.3, north: 52.6, east: 13.5 },
      features: [],
    };

    const next = cityDesignReducer(state, {
      type: 'set_osm_snapshot',
      origin,
      osmSnapshot,
    });

    expect(next.design.origin).toEqual(origin);
    expect(next.design.osmSnapshot).toEqual(osmSnapshot);
    expect(next.selectedOsmWayId).toBeNull();
    expect(next.selectedObjectFocusRequestKey).toBe(0);
    expect(next.selectedOsmFocusRequestKey).toBe(0);
    expect(next.isDirty).toBe(true);
  });

  it('updates corridor width and object unit cost through reducer actions', () => {
    const corridor = createCorridorCityDesignObject({
      id: 'corridor-1',
      type: 'parking_area',
      start: { x: 0, z: 0 },
      end: { x: 10, z: 0 },
      width: 4,
    });
    const point = createPointCityDesignObject({
      id: 'point-1',
      type: 'tree',
      point: { x: 2, z: 3 },
    });
    const initial = createInitialCityDesignEditorState({
      ...createEmptyCityDesignState(),
      objects: [corridor, point],
    });

    const resized = cityDesignReducer(initial, {
      type: 'update_object_width',
      objectId: corridor.id,
      width: 7,
    });
    const repriced = cityDesignReducer(resized, {
      type: 'update_object_unit_cost',
      objectId: point.id,
      unitCostMinor: 275,
    });

    expect(resized.design.objects[0].geometry).toMatchObject({ kind: 'corridor', width: 7 });
    expect(repriced.design.objects[1].cost.customUnitCostMinor).toBe(275);
    expect(repriced.isDirty).toBe(true);
  });

  it('preserves a different selection when deleting an object', () => {
    const selected = createPointCityDesignObject({
      id: 'selected',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const deleted = createPointCityDesignObject({
      id: 'deleted',
      type: 'tree',
      point: { x: 1, z: 1 },
    });
    const state = {
      ...createInitialCityDesignEditorState({
        ...createEmptyCityDesignState(),
        objects: [selected, deleted],
      }),
      selectedObjectId: selected.id,
    };

    const next = cityDesignReducer(state, { type: 'delete_object', objectId: deleted.id });

    expect(next.design.objects).toEqual([selected]);
    expect(next.selectedObjectId).toBe(selected.id);
  });
});

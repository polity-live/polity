import { describe, expect, it } from 'vitest';
import {
  createCorridorCityDesignObject,
  createCorridorPreview,
  createPathCorridorCityDesignObject,
  createPathCorridorPreview,
  createPointCityDesignObject,
} from '../../logic/cityDesignPlacement';
import {
  cityDesignReducer,
  cityDesignReducerInternals as helpers,
  createEmptyCityDesignState,
  createInitialCityDesignEditorState,
  normalizeCityDesignStateV1,
  parseStoredCityDesignState,
} from '../cityDesignReducer';

const point = createPointCityDesignObject({
  id: 'point',
  type: 'tree',
  point: { x: 0, z: 0 },
});
const corridor = createCorridorCityDesignObject({
  id: 'corridor',
  type: 'parking_area',
  start: { x: 0, z: 0 },
  end: { x: 10, z: 0 },
  width: 4,
});
const path = createPathCorridorCityDesignObject({
  id: 'path',
  type: 'street',
  points: [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
  ],
  width: 5,
});

describe('cityDesignReducer A04 branch accountability', () => {
  it('normalizes optional hidden feature arrays and helper alternatives', () => {
    const design = createEmptyCityDesignState();
    expect(
      normalizeCityDesignStateV1({
        ...design,
        hiddenOsmWayIds: undefined,
        hiddenOsmFeatureIds: undefined,
      } as any).hiddenOsmFeatureIds
    ).toEqual([]);
    expect(
      normalizeCityDesignStateV1({
        ...design,
        hiddenOsmWayIds: ['one'],
        hiddenOsmFeatureIds: ['two', 'one'],
      }).hiddenOsmFeatureIds
    ).toEqual(['one', 'two']);

    const updated = helpers.updateObject([point, corridor], 'point', object => ({
      ...object,
      properties: { ...object.properties, visible: false },
    }));
    expect(updated[0]?.properties.visible).toBe(false);
    expect(updated[1]).toBe(corridor);
    expect(helpers.getCityDesignObjectEndpoints(point)).toEqual([]);
    expect(helpers.getCityDesignObjectEndpoints(corridor)).toHaveLength(2);
    expect(helpers.getCityDesignObjectEndpoints(path)).toHaveLength(2);
    expect(
      helpers.getCityDesignObjectEndpoints({
        ...path,
        geometry: { ...path.geometry, points: [] } as any,
      })
    ).toEqual([]);
    expect(helpers.getCorridorDefaultWidth('tree')).toBe(1.8);
    expect(helpers.getCorridorDefaultWidth('bank')).toBe(2);
    expect(helpers.updateCityDesignObjectProperties('tree', {}, 'species', 'fruit')).toEqual({
      species: 'fruit',
    });
    expect(helpers.updateCityDesignObjectProperties('building', {}, 'use', 'office')).toMatchObject(
      {
        use: 'office',
        semanticUse: 'office',
      }
    );
    expect(helpers.createPlacementSettings('tree').width).toBe(1.8);
    expect(helpers.createPlacementSettings('bike_lane', {}, 2.5).width).toBe(2.5);
    const unlocked = helpers.createPlacementSettings('tree');
    const locked = { ...unlocked, rotationLocked: true, rotationDeg: 45 };
    expect(helpers.getPlacementOverrides(unlocked, 'EUR')).not.toHaveProperty('rotationDeg');
    expect(helpers.getPlacementOverrides(locked, undefined)).toHaveProperty('rotationDeg', 45);
  });

  it('updates absent, corridor, and path placement previews', () => {
    expect(helpers.updatePlacementDraftWidth(null, 3)).toBeNull();
    const noPreview = {
      type: 'parking_area',
      mode: 'drag_band',
      start: { x: 0, z: 0 },
      points: [{ x: 0, z: 0 }],
      preview: null,
    } as any;
    expect(helpers.updatePlacementDraftWidth(noPreview, 3)).toBe(noPreview);
    const corridorDraft = {
      ...noPreview,
      preview: createCorridorPreview({ x: 0, z: 0 }, { x: 10, z: 0 }, 2),
    };
    expect(helpers.updatePlacementDraftWidth(corridorDraft, 4)?.preview?.width).toBe(4);
    const pathDraft = {
      type: 'street',
      mode: 'path',
      start: { x: 1, z: 1 },
      points: [{ x: 1, z: 1 }],
      preview: createPathCorridorPreview([], { x: 1, z: 1 }, 2),
    } as any;
    expect(helpers.updatePlacementDraftWidth(pathDraft, 6)?.preview?.width).toBe(6);
    expect(
      helpers.updatePlacementDraftWidth(
        { ...pathDraft, preview: { ...pathDraft.preview, points: [] } },
        7
      )?.preview?.width
    ).toBe(7);
  });

  it('snaps only same-type nearby endpoints and exercises finish guards', () => {
    expect(
      helpers.snapPointToSameTypeEndpoint({
        point: { x: 10.5, z: 0.2 },
        objects: [corridor, path],
        type: 'street',
      })
    ).toEqual({ x: 10, z: 0 });
    expect(
      helpers.snapPointToSameTypeEndpoint({
        point: { x: 50, z: 50 },
        objects: [corridor, path],
        type: 'street',
      })
    ).toEqual({ x: 50, z: 50 });
    expect(
      helpers.snapPointToSameTypeEndpoint({
        point: { x: 0, z: 0 },
        objects: [corridor],
        type: 'tree',
      })
    ).toEqual({ x: 0, z: 0 });

    const initial = createInitialCityDesignEditorState();
    expect(helpers.finishPathPlacementDraft(initial, 'none')).toBe(initial);
    expect(
      helpers.finishPathPlacementDraft(
        {
          ...initial,
          placementDraft: {
            type: 'street',
            mode: 'path',
            start: { x: 0, z: 0 },
            points: [{ x: 0, z: 0 }],
            preview: null,
          },
        },
        'short'
      ).design.objects
    ).toHaveLength(0);
    expect(helpers.finishCurrentPlacementDraft(initial, 'none')).toBe(initial);
    expect(
      helpers.finishCurrentPlacementDraft(
        {
          ...initial,
          placementDraft: {
            type: 'parking_area',
            mode: 'drag_band',
            start: { x: 0, z: 0 },
            points: [{ x: 0, z: 0 }],
            preview: null,
          },
        },
        'missing-preview'
      ).design.objects
    ).toHaveLength(0);
  });

  it('covers map, selection, mode, display, and placement action alternatives', () => {
    let state = createInitialCityDesignEditorState({
      ...createEmptyCityDesignState(),
      osmSnapshot: { bbox: { south: 0, west: 0, north: 1, east: 1 }, elements: [] } as any,
      hiddenOsmWayIds: ['old'],
      hiddenOsmFeatureIds: ['feature'],
      objects: [point, corridor, path],
    });
    state = cityDesignReducer(state, {
      type: 'replace_design',
      design: state.design,
      dirty: true,
    });
    expect(state.isDirty).toBe(true);
    state = cityDesignReducer(state, {
      type: 'replace_design',
      design: state.design,
    });
    expect(state.isDirty).toBe(false);

    state = cityDesignReducer(state, {
      type: 'set_map_context',
      mapSelection: { center: { lat: 1, lon: 2 } } as any,
      selectionAddress: { formatted: 'Address' } as any,
      invalidateOsm: false,
    });
    expect(state.design.origin.label).toBe('Address');
    state = cityDesignReducer(state, {
      type: 'set_map_context',
      mapSelection: { center: { lat: 3, lon: 4 } } as any,
      selectionAddress: undefined,
      invalidateOsm: true,
    });
    expect(state.design.osmSnapshot).toBeNull();
    state = cityDesignReducer(state, {
      type: 'set_selection_address',
      selectionAddress: { formatted: 'New' } as any,
    });
    expect(state.design.origin.label).toBe('New');
    state = cityDesignReducer(state, {
      type: 'set_selection_address',
      selectionAddress: undefined,
    });
    expect(state.design.origin.label).toBeUndefined();

    state = cityDesignReducer(state, { type: 'set_comparison_mode', comparisonMode: 'split' });
    state = cityDesignReducer(state, { type: 'set_show_street_markings', visible: false });
    state = cityDesignReducer(state, {
      type: 'set_osm_layer_visibility',
      layer: 'roads',
      visible: false,
    } as any);
    state = cityDesignReducer(state, { type: 'set_interaction_mode', interactionMode: 'place' });
    state = cityDesignReducer(state, { type: 'set_interaction_mode', interactionMode: 'camera' });
    expect(state.placementDraft).toBeNull();

    state = cityDesignReducer(state, { type: 'set_tool', objectType: 'bank' });
    state = cityDesignReducer(state, { type: 'set_placement_rotation', rotationDeg: 30 });
    state = cityDesignReducer(state, {
      type: 'scene_pointer_down',
      point: { x: 1, z: 1 },
      id: 'rotated-tree',
    });
    expect(state.design.objects.some(object => object.id === 'rotated-tree')).toBe(true);

    state = cityDesignReducer(state, { type: 'set_tool', objectType: 'street' });
    state = cityDesignReducer(state, {
      type: 'scene_pointer_down',
      point: { x: 20, z: 20 },
      id: 'draft',
    });
    const unchanged = cityDesignReducer(state, {
      type: 'scene_pointer_down',
      point: { x: 20.1, z: 20.1 },
      id: 'duplicate',
    });
    expect(unchanged).toBe(state);
    state = cityDesignReducer(state, { type: 'scene_pointer_move', point: { x: 30, z: 20 } });
    expect(state.placementDraft?.preview?.kind).toBe('path_corridor');

    const emptyPathDraft = {
      ...state,
      interactionMode: 'place',
      placementDraft: {
        type: 'street',
        mode: 'path',
        start: { x: 40, z: 40 },
        points: [],
        preview: null,
      },
    } as any;
    const firstPathPoint = cityDesignReducer(emptyPathDraft, {
      type: 'scene_pointer_down',
      point: { x: 45, z: 45 },
      id: 'first',
    });
    expect(firstPathPoint.placementDraft?.points).toHaveLength(1);
    expect(firstPathPoint.placementDraft?.preview).toBeNull();
    expect(
      cityDesignReducer(createInitialCityDesignEditorState(), {
        type: 'scene_pointer_move',
        point: { x: 1, z: 1 },
      }).placementDraft
    ).toBeNull();
    expect(
      cityDesignReducer(
        { ...createInitialCityDesignEditorState(), interactionMode: 'place' },
        { type: 'scene_pointer_move', point: { x: 1, z: 1 } }
      ).placementDraft
    ).toBeNull();
  });

  it('covers selection, visibility, OSM import, delete, and parse alternatives', () => {
    let state = {
      ...createInitialCityDesignEditorState({
        ...createEmptyCityDesignState(),
        objects: [point, corridor],
      }),
      selectedObjectId: 'point',
      selectedOsmWayId: 'way',
      hiddenObjectIds: ['point'],
      hiddenObjectCategories: ['greenery'],
    } as any;
    state = cityDesignReducer(state, { type: 'select_object', objectId: 'point' });
    state = cityDesignReducer(state, { type: 'select_object', objectId: null });
    state = cityDesignReducer(
      { ...state, selectedObjectId: 'point' },
      { type: 'select_osm_way', osmWayId: 'way' }
    );
    state = cityDesignReducer(state, { type: 'select_osm_way', osmWayId: null });

    state = cityDesignReducer(
      { ...state, selectedObjectId: 'point' },
      { type: 'set_object_visibility', objectId: 'point', visible: false }
    );
    expect(state.selectedObjectId).toBeNull();
    state = cityDesignReducer(state, {
      type: 'set_object_visibility',
      objectId: 'point',
      visible: true,
    });
    state = cityDesignReducer(
      { ...state, selectedObjectId: 'corridor' },
      { type: 'set_object_visibility', objectId: 'point', visible: false }
    );
    expect(state.selectedObjectId).toBe('corridor');

    state = cityDesignReducer(
      { ...state, selectedObjectId: 'point' },
      { type: 'set_object_category_visibility', category: 'greenery', visible: false }
    );
    expect(state.selectedObjectId).toBeNull();
    state = cityDesignReducer(state, {
      type: 'set_object_category_visibility',
      category: 'greenery',
      visible: true,
    });
    state = cityDesignReducer(
      { ...state, selectedObjectId: 'corridor' },
      { type: 'set_object_category_visibility', category: 'greenery', visible: false }
    );
    expect(state.selectedObjectId).toBe('corridor');

    state = cityDesignReducer(
      {
        ...state,
        selectedOsmWayId: 'way',
        design: { ...state.design, hiddenOsmWayIds: undefined, hiddenOsmFeatureIds: undefined },
      },
      { type: 'hide_osm_way', osmWayId: 'way' }
    );
    expect(state.selectedOsmWayId).toBeNull();
    state = cityDesignReducer(
      { ...state, selectedOsmWayId: 'other' },
      { type: 'hide_osm_way', osmWayId: 'way' }
    );
    expect(state.selectedOsmWayId).toBe('other');

    expect(
      cityDesignReducer(state, { type: 'import_osm_feature', osmWayId: 'way', objects: [] })
    ).toBe(state);
    state = cityDesignReducer(state, {
      type: 'import_osm_feature',
      osmWayId: 'way',
      objects: [point],
    });
    expect(state.selectedObjectId).toBe('point');
    expect(cityDesignReducer(state, { type: 'undo_osm_import', osmWayId: 'missing' })).toBe(state);
    const imported = { ...point, provenance: { source: 'osm', featureId: 'way' } } as any;
    state = { ...state, design: { ...state.design, objects: [imported, corridor] } };
    state = cityDesignReducer(state, { type: 'undo_osm_import', osmWayId: 'way' });
    expect(state.design.objects).toEqual([corridor]);

    state = { ...state, selectedObjectId: 'corridor', hiddenObjectIds: ['corridor'] };
    state = cityDesignReducer(state, { type: 'delete_object', objectId: 'corridor' });
    expect(state.selectedObjectId).toBeNull();
    const unchangedDelete = cityDesignReducer(state, {
      type: 'delete_object_category',
      category: 'building',
    });
    expect(unchangedDelete.isDirty).toBe(state.isDirty);
    state = {
      ...state,
      design: { ...state.design, objects: [point, corridor] },
      selectedObjectId: 'point',
    };
    state = cityDesignReducer(state, { type: 'delete_object_category', category: 'greenery' });
    expect(state.selectedObjectId).toBeNull();

    expect(cityDesignReducer(state, { type: 'unknown' } as any)).toBe(state);
    expect(parseStoredCityDesignState(null)).toBeNull();
    expect(parseStoredCityDesignState([])).toBeNull();
    expect(parseStoredCityDesignState({ schemaVersion: 2 })).toBeNull();
    expect(parseStoredCityDesignState({ schemaVersion: 1, origin: null, objects: [] })).toBeNull();
    expect(
      parseStoredCityDesignState({ schemaVersion: 1, origin: { lat: 1, lon: 2 }, objects: null })
    ).toBeNull();
    expect(parseStoredCityDesignState(createEmptyCityDesignState())).not.toBeNull();
  });
});

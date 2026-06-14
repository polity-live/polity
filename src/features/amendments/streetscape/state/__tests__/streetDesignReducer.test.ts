import { describe, expect, it } from 'vitest';
import { createPathCorridorStreetDesignObject } from '../../logic/streetDesignPlacement';
import { createInitialStreetDesignEditorState, streetDesignReducer } from '../streetDesignReducer';

describe('streetDesignReducer', () => {
  it('does not place objects while camera mode is active', () => {
    const initialState = createInitialStreetDesignEditorState();
    const cameraState = streetDesignReducer(initialState, {
      type: 'set_interaction_mode',
      interactionMode: 'camera',
    });
    const nextState = streetDesignReducer(cameraState, {
      type: 'scene_pointer_down',
      point: { x: 3, z: 4 },
      id: 'tree-1',
    });

    expect(nextState.design.objects).toHaveLength(0);
    expect(nextState.interactionMode).toBe('camera');
  });

  it('switches from original to overlay when placement starts', () => {
    const initialState = createInitialStreetDesignEditorState({
      ...createInitialStreetDesignEditorState().design,
      comparisonMode: 'original',
    });
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'bank',
    });
    const nextState = streetDesignReducer(withTool, {
      type: 'scene_pointer_down',
      point: { x: 3, z: 4 },
      id: 'bank-1',
    });

    expect(nextState.design.comparisonMode).toBe('overlay');
    expect(nextState.design.objects).toHaveLength(1);
  });

  it('keeps non-linear corridor click-drag-click placement unchanged', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'parking_area',
    });
    const withStart = streetDesignReducer(withTool, {
      type: 'scene_pointer_down',
      point: { x: 0, z: 0 },
      id: 'draft-id',
    });

    expect(withStart.placementDraft?.start).toEqual({ x: 0, z: 0 });
    expect(withStart.design.objects).toHaveLength(0);

    const withPreview = streetDesignReducer(withStart, {
      type: 'scene_pointer_move',
      point: { x: 10, z: 0 },
    });
    const finalized = streetDesignReducer(withPreview, {
      type: 'scene_pointer_down',
      point: { x: 10, z: 0 },
      id: 'parking-1',
    });

    expect(finalized.placementDraft).toBeNull();
    expect(finalized.design.objects).toHaveLength(1);
    expect(finalized.design.objects[0].type).toBe('parking_area');
    expect(finalized.selectedObjectId).toBe('parking-1');
  });

  it('collects linear path points and finalizes them with the finish action', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'bike_lane',
    });
    const withStart = streetDesignReducer(withTool, {
      type: 'scene_pointer_down',
      point: { x: 0, z: 0 },
      id: 'draft-id',
    });
    const withSecondPoint = streetDesignReducer(withStart, {
      type: 'scene_pointer_down',
      point: { x: 10, z: 0 },
      id: 'unused-id',
    });
    const withThirdPoint = streetDesignReducer(withSecondPoint, {
      type: 'scene_pointer_down',
      point: { x: 10, z: 10 },
      id: 'unused-id-2',
    });

    expect(withThirdPoint.placementDraft?.mode).toBe('path');
    expect(withThirdPoint.placementDraft?.points).toHaveLength(3);
    expect(withThirdPoint.design.objects).toHaveLength(0);

    const finalized = streetDesignReducer(withThirdPoint, {
      type: 'finish_path_placement',
      id: 'bike-path-1',
    });

    expect(finalized.placementDraft).toBeNull();
    expect(finalized.design.objects).toHaveLength(1);
    expect(finalized.design.objects[0].type).toBe('bike_lane');
    expect(finalized.design.objects[0].geometry.kind).toBe('path_corridor');
    expect(finalized.selectedObjectId).toBe('bike-path-1');
  });

  it('creates tree rows as path corridor objects', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'tree',
    });
    const withStart = streetDesignReducer(withTool, {
      type: 'scene_pointer_down',
      point: { x: 0, z: 0 },
      id: 'draft-id',
    });
    const withSecondPoint = streetDesignReducer(withStart, {
      type: 'scene_pointer_down',
      point: { x: 12, z: 0 },
      id: 'unused-id',
    });
    const finalized = streetDesignReducer(withSecondPoint, {
      type: 'finish_path_placement',
      id: 'tree-row-1',
    });

    expect(finalized.design.objects).toHaveLength(1);
    expect(finalized.design.objects[0].type).toBe('tree');
    expect(finalized.design.objects[0].geometry.kind).toBe('path_corridor');
    expect(finalized.selectedObjectId).toBe('tree-row-1');
  });

  (['grass_strip', 'flower_bed', 'water_area', 'bush'] as const).forEach(objectType => {
    it(`creates ${objectType} objects through path placement`, () => {
      const initialState = createInitialStreetDesignEditorState();
      const withTool = streetDesignReducer(initialState, {
        type: 'set_tool',
        objectType,
      });
      const withStart = streetDesignReducer(withTool, {
        type: 'scene_pointer_down',
        point: { x: 0, z: 0 },
        id: 'draft-id',
      });
      const withSecondPoint = streetDesignReducer(withStart, {
        type: 'scene_pointer_down',
        point: { x: 8, z: 0 },
        id: 'unused-id',
      });
      const finalized = streetDesignReducer(withSecondPoint, {
        type: 'finish_path_placement',
        id: `${objectType}-1`,
      });

      expect(finalized.design.objects).toHaveLength(1);
      expect(finalized.design.objects[0].type).toBe(objectType);
      expect(finalized.design.objects[0].geometry.kind).toBe('path_corridor');
    });
  });

  it('cancels active path placement without creating an object', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'street',
    });
    const withStart = streetDesignReducer(withTool, {
      type: 'scene_pointer_down',
      point: { x: 0, z: 0 },
      id: 'draft-id',
    });
    const cancelled = streetDesignReducer(withStart, { type: 'cancel_placement' });

    expect(cancelled.placementDraft).toBeNull();
    expect(cancelled.design.objects).toHaveLength(0);
  });

  it('snaps new path points to nearby endpoints of the same object type', () => {
    const existingStreet = createPathCorridorStreetDesignObject({
      id: 'street-existing',
      type: 'street',
      points: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
      ],
    });
    const initialState = createInitialStreetDesignEditorState({
      ...createInitialStreetDesignEditorState().design,
      objects: [existingStreet],
    });
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'street',
    });
    const withSnappedStart = streetDesignReducer(withTool, {
      type: 'scene_pointer_down',
      point: { x: 10.7, z: 0.3 },
      id: 'draft-id',
    });

    expect(withSnappedStart.placementDraft?.points[0]).toEqual({ x: 10, z: 0 });
  });

  it('finalizes an active corridor draft on the second click even without a live preview', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'parking_area',
    });
    const withStart = streetDesignReducer(withTool, {
      type: 'scene_pointer_down',
      point: { x: 2, z: 2 },
      id: 'draft-id',
    });
    const finalized = streetDesignReducer(withStart, {
      type: 'scene_pointer_down',
      point: { x: 8, z: 2 },
      id: 'parking-1',
    });

    expect(finalized.placementDraft).toBeNull();
    expect(finalized.design.objects).toHaveLength(1);
    expect(finalized.design.objects[0].type).toBe('parking_area');
    expect(finalized.selectedObjectId).toBe('parking-1');
  });

  it('creates building objects through path placement', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'building',
    });
    const withStart = streetDesignReducer(withTool, {
      type: 'scene_pointer_down',
      point: { x: 0, z: 0 },
      id: 'draft-id',
    });
    const withSecondPoint = streetDesignReducer(withStart, {
      type: 'scene_pointer_down',
      point: { x: 12, z: 0 },
      id: 'unused-id',
    });
    const finalized = streetDesignReducer(withSecondPoint, {
      type: 'finish_path_placement',
      id: 'building-1',
    });

    expect(finalized.design.objects).toHaveLength(1);
    expect(finalized.design.objects[0].type).toBe('building');
    expect(finalized.design.objects[0].geometry.kind).toBe('path_corridor');
    expect(finalized.selectedObjectId).toBe('building-1');
  });

  it('removes deleted objects and clears selection', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'bank',
    });
    const withBank = streetDesignReducer(withTool, {
      type: 'scene_pointer_down',
      point: { x: 3, z: 4 },
      id: 'bank-1',
    });
    const deleted = streetDesignReducer(withBank, {
      type: 'delete_object',
      objectId: 'bank-1',
    });

    expect(deleted.design.objects).toHaveLength(0);
    expect(deleted.selectedObjectId).toBeNull();
  });

  it('toggles OSM layer visibility', () => {
    const initialState = createInitialStreetDesignEditorState();
    const nextState = streetDesignReducer(initialState, {
      type: 'set_osm_layer_visibility',
      layer: 'building',
      visible: false,
    });

    expect(nextState.design.osmLayerVisibility?.building).toBe(false);
    expect(nextState.design.osmLayerVisibility?.road).toBe(true);
    expect(nextState.isDirty).toBe(true);
  });

  it('hides selected OSM ways from the rendered map', () => {
    const initialState = createInitialStreetDesignEditorState({
      ...createInitialStreetDesignEditorState().design,
      osmSnapshot: {
        fetchedAt: 1,
        bbox: { south: 0, west: 0, north: 1, east: 1 },
        ways: [
          {
            id: 'building-1',
            kind: 'building',
            points: [
              { lat: 0, lon: 0 },
              { lat: 0, lon: 1 },
              { lat: 1, lon: 1 },
            ],
          },
        ],
      },
    });
    const selected = streetDesignReducer(initialState, {
      type: 'select_osm_way',
      osmWayId: 'building-1',
    });
    const hidden = streetDesignReducer(selected, {
      type: 'hide_osm_way',
      osmWayId: 'building-1',
    });

    expect(hidden.design.hiddenOsmWayIds).toContain('building-1');
    expect(hidden.selectedOsmWayId).toBeNull();
    expect(hidden.isDirty).toBe(true);
  });
});

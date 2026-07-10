import { describe, expect, it } from 'vitest';
import {
  createPathCorridorStreetDesignObject,
  createPointStreetDesignObject,
  getStreetDesignGeometryRotationDeg,
} from '../../logic/streetDesignPlacement';
import {
  createInitialStreetDesignEditorState,
  parseStoredStreetDesignState,
  streetDesignReducer,
} from '../streetDesignReducer';

describe('streetDesignReducer', () => {
  it('starts in select mode by default', () => {
    const initialState = createInitialStreetDesignEditorState();

    expect(initialState.interactionMode).toBe('select');
  });

  it('keeps building use and color in sync for placement and selected objects', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withOfficeTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'building',
      propertyOverrides: { use: 'office' },
    });

    expect(withOfficeTool.placementSettings.properties).toEqual(
      expect.objectContaining({
        color: '#6f7a82',
        renderColor: '#6f7a82',
        semanticUse: 'office',
        use: 'office',
      })
    );

    const withResidentialUse = streetDesignReducer(withOfficeTool, {
      type: 'set_placement_property',
      key: 'use',
      value: 'residential',
    });

    expect(withResidentialUse.placementSettings.properties).toEqual(
      expect.objectContaining({
        color: '#c8bda7',
        renderColor: '#c8bda7',
        semanticUse: 'residential',
        use: 'residential',
      })
    );

    const building = createPathCorridorStreetDesignObject({
      id: 'building-1',
      type: 'building',
      points: [
        { x: 0, z: 0 },
        { x: 12, z: 0 },
      ],
    });
    const withBuilding = {
      ...initialState,
      design: {
        ...initialState.design,
        objects: [building],
      },
    };
    const updated = streetDesignReducer(withBuilding, {
      type: 'update_object_property',
      objectId: 'building-1',
      key: 'use',
      value: 'civic',
    });

    expect(updated.design.objects[0].properties).toEqual(
      expect.objectContaining({
        color: '#8ba77f',
        renderColor: '#8ba77f',
        semanticUse: 'civic',
        use: 'civic',
      })
    );
  });

  it('applies preset properties and width overrides when switching tools', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withConiferTree = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'tree',
      propertyOverrides: {
        canopyDiameter: 2.8,
        height: 6,
        spacing: 6,
        species: 'conifer',
      },
    });
    const withProtectedBikeLane = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'bike_lane',
      propertyOverrides: { protection: 'protected' },
      widthOverride: 2.2,
    });

    expect(withConiferTree.selectedTool).toBe('tree');
    expect(withConiferTree.placementSettings.properties).toEqual(
      expect.objectContaining({
        canopyDiameter: 2.8,
        height: 6,
        spacing: 6,
        species: 'conifer',
      })
    );

    expect(withProtectedBikeLane.selectedTool).toBe('bike_lane');
    expect(withProtectedBikeLane.placementSettings.type).toBe('bike_lane');
    expect(withProtectedBikeLane.placementSettings.width).toBe(2.2);
    expect(withProtectedBikeLane.placementSettings.properties).toEqual(
      expect.objectContaining({
        protection: 'protected',
        surface: 'asphalt',
      })
    );
  });

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

  it('does not place objects while select mode is active', () => {
    const initialState = createInitialStreetDesignEditorState();
    const nextState = streetDesignReducer(initialState, {
      type: 'scene_pointer_down',
      point: { x: 3, z: 4 },
      id: 'tree-1',
    });

    expect(nextState.design.objects).toHaveLength(0);
    expect(nextState.interactionMode).toBe('select');
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

  it('finalizes an active corridor draft with the finish action after dragging', () => {
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
    const withPreview = streetDesignReducer(withStart, {
      type: 'scene_pointer_move',
      point: { x: 10, z: 0 },
    });
    const finalized = streetDesignReducer(withPreview, {
      type: 'finish_placement',
      id: 'parking-keyboard-1',
    });

    expect(finalized.placementDraft).toBeNull();
    expect(finalized.design.objects).toHaveLength(1);
    expect(finalized.design.objects[0].type).toBe('parking_area');
    expect(finalized.design.objects[0].geometry.kind).toBe('corridor');
    expect(finalized.selectedObjectId).toBe('parking-keyboard-1');
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

  it('finalizes an active path draft with the generic finish action', () => {
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
    const finalized = streetDesignReducer(withSecondPoint, {
      type: 'finish_placement',
      id: 'bike-path-keyboard-1',
    });

    expect(finalized.placementDraft).toBeNull();
    expect(finalized.design.objects).toHaveLength(1);
    expect(finalized.design.objects[0].geometry.kind).toBe('path_corridor');
    expect(finalized.selectedObjectId).toBe('bike-path-keyboard-1');
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

  it('applies current draft settings to placed objects and then resets them', () => {
    const initialState = createInitialStreetDesignEditorState();
    const withTool = streetDesignReducer(initialState, {
      type: 'set_tool',
      objectType: 'building',
    });
    const withWidth = streetDesignReducer(withTool, {
      type: 'set_placement_width',
      width: 12,
    });
    const withHeight = streetDesignReducer(withWidth, {
      type: 'set_placement_property',
      key: 'height',
      value: 14,
    });
    const withCost = streetDesignReducer(withHeight, {
      type: 'set_placement_unit_cost',
      unitCostMinor: 300000,
    });
    const withStart = streetDesignReducer(withCost, {
      type: 'scene_pointer_down',
      point: { x: 0, z: 0 },
      id: 'draft-id',
    });
    const withSecondPoint = streetDesignReducer(withStart, {
      type: 'scene_pointer_down',
      point: { x: 10, z: 0 },
      id: 'unused-id',
    });
    const finalized = streetDesignReducer(withSecondPoint, {
      type: 'finish_path_placement',
      id: 'building-custom',
    });

    const object = finalized.design.objects[0];
    expect(object.type).toBe('building');
    expect(object.properties.height).toBe(14);
    expect(object.cost.customUnitCostMinor).toBe(300000);
    expect(object.geometry.kind).toBe('path_corridor');
    if (object.geometry.kind === 'path_corridor') {
      expect(object.geometry.width).toBe(12);
    }
    expect(finalized.placementSettings.width).toBe(10);
    expect(finalized.interactionMode).toBe('select');
  });

  it('rotates selected corridor objects around their center', () => {
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
    const withObject = streetDesignReducer(withStart, {
      type: 'scene_pointer_down',
      point: { x: 10, z: 0 },
      id: 'parking-rotate',
    });
    const rotated = streetDesignReducer(withObject, {
      type: 'rotate_object',
      objectId: 'parking-rotate',
      rotationDeg: 0,
    });
    const object = rotated.design.objects[0];

    expect(getStreetDesignGeometryRotationDeg(object.geometry)).toBe(0);
    expect(object.geometry.kind).toBe('corridor');
    if (object.geometry.kind === 'corridor') {
      expect(object.geometry.start.x).toBeCloseTo(5);
      expect(object.geometry.end.x).toBeCloseTo(5);
      expect(object.geometry.start.z).toBeCloseTo(-5);
      expect(object.geometry.end.z).toBeCloseTo(5);
    }
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

  it('creates a new OSM focus request when selecting an existing object again', () => {
    const initialState = createInitialStreetDesignEditorState();
    const selected = streetDesignReducer(initialState, {
      type: 'select_osm_way',
      osmWayId: 'building-1',
    });
    const selectedAgain = streetDesignReducer(selected, {
      type: 'select_osm_way',
      osmWayId: 'building-1',
    });

    expect(selected.selectedOsmWayId).toBe('building-1');
    expect(selected.selectedOsmFocusRequestKey).toBe(1);
    expect(selectedAgain.selectedOsmWayId).toBe('building-1');
    expect(selectedAgain.selectedOsmFocusRequestKey).toBe(2);
  });

  it('creates a new design object focus request when selecting an element again', () => {
    const initialState = createInitialStreetDesignEditorState();
    const selected = streetDesignReducer(initialState, {
      type: 'select_object',
      objectId: 'building-1',
    });
    const selectedAgain = streetDesignReducer(selected, {
      type: 'select_object',
      objectId: 'building-1',
    });

    expect(selected.selectedObjectId).toBe('building-1');
    expect(selected.selectedObjectFocusRequestKey).toBe(1);
    expect(selectedAgain.selectedObjectId).toBe('building-1');
    expect(selectedAgain.selectedObjectFocusRequestKey).toBe(2);
  });

  it('keeps a selected design object when clearing OSM selection', () => {
    const tree = createPointStreetDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const initialState = createInitialStreetDesignEditorState({
      ...createInitialStreetDesignEditorState().design,
      objects: [tree],
    });
    const selected = streetDesignReducer(initialState, {
      type: 'select_object',
      objectId: 'tree-1',
    });
    const clearedOsmSelection = streetDesignReducer(selected, {
      type: 'select_osm_way',
      osmWayId: null,
    });
    const selectedOsmWay = streetDesignReducer(clearedOsmSelection, {
      type: 'select_osm_way',
      osmWayId: 'osm-building-1',
    });

    expect(clearedOsmSelection.selectedObjectId).toBe('tree-1');
    expect(clearedOsmSelection.selectedOsmWayId).toBeNull();
    expect(selectedOsmWay.selectedObjectId).toBeNull();
    expect(selectedOsmWay.selectedOsmWayId).toBe('osm-building-1');
  });

  it('tracks hidden design elements and groups without changing saved objects', () => {
    const tree = createPointStreetDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const initialState = createInitialStreetDesignEditorState({
      ...createInitialStreetDesignEditorState().design,
      objects: [tree],
    });
    const hiddenObject = streetDesignReducer(initialState, {
      type: 'set_object_visibility',
      objectId: 'tree-1',
      visible: false,
    });
    const hiddenGroup = streetDesignReducer(hiddenObject, {
      type: 'set_object_category_visibility',
      category: 'greenery',
      visible: false,
    });

    expect(hiddenObject.hiddenObjectIds).toContain('tree-1');
    expect(hiddenObject.design.objects).toHaveLength(1);
    expect(hiddenGroup.hiddenObjectCategories).toContain('greenery');
    expect(hiddenGroup.design.objects).toHaveLength(1);
  });

  it('removes all design elements in a group', () => {
    const tree = createPointStreetDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const bank = createPointStreetDesignObject({
      id: 'bank-1',
      type: 'bank',
      point: { x: 1, z: 1 },
    });
    const initialState = createInitialStreetDesignEditorState({
      ...createInitialStreetDesignEditorState().design,
      objects: [tree, bank],
    });
    const nextState = streetDesignReducer(initialState, {
      type: 'delete_object_category',
      category: 'greenery',
    });

    expect(nextState.design.objects).toHaveLength(1);
    expect(nextState.design.objects[0]?.id).toBe('bank-1');
    expect(nextState.isDirty).toBe(true);
  });

  it('hides selected OSM ways from the rendered map', () => {
    const initialState = createInitialStreetDesignEditorState({
      ...createInitialStreetDesignEditorState().design,
      osmSnapshot: {
        fetchedAt: 1,
        bbox: { south: 0, west: 0, north: 1, east: 1 },
        features: [
          {
            id: 'building-1',
            kind: 'building',
            geometryKind: 'polygon',
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
    expect(hidden.design.hiddenOsmFeatureIds).toContain('building-1');
    expect(hidden.selectedOsmWayId).toBeNull();
    expect(hidden.isDirty).toBe(true);
  });

  it('imports OSM objects atomically, hides the source, and marks the design dirty', () => {
    const initialState = createInitialStreetDesignEditorState();
    const tree = createPointStreetDesignObject({
      id: 'imported-tree',
      type: 'tree',
      point: { x: 2, z: 3 },
    });
    const imported = streetDesignReducer(initialState, {
      type: 'import_osm_feature',
      osmWayId: 'osm-tree-1',
      objects: [tree],
    });

    expect(imported.design.objects).toEqual([tree]);
    expect(imported.design.hiddenOsmFeatureIds).toContain('osm-tree-1');
    expect(imported.selectedObjectId).toBe('imported-tree');
    expect(imported.selectedOsmWayId).toBeNull();
    expect(imported.isDirty).toBe(true);

    const importedObject = {
      ...tree,
      provenance: {
        source: 'osm' as const,
        featureId: 'osm-tree-1',
        confidence: 'exact' as const,
      },
    };
    const reverted = streetDesignReducer(
      {
        ...imported,
        design: { ...imported.design, objects: [importedObject] },
      },
      { type: 'undo_osm_import', osmWayId: 'osm-tree-1' }
    );

    expect(reverted.design.objects).toHaveLength(0);
    expect(reverted.design.hiddenOsmFeatureIds).not.toContain('osm-tree-1');
  });

  it('normalizes old OSM ways and layer visibility when parsing saved designs', () => {
    const parsed = parseStoredStreetDesignState({
      ...createInitialStreetDesignEditorState().design,
      osmLayerVisibility: { road: true, building: true, green: true, water: true },
      hiddenOsmWayIds: ['legacy-road-1'],
      osmSnapshot: {
        fetchedAt: 1,
        bbox: { south: 0, west: 0, north: 1, east: 1 },
        ways: [
          {
            id: 'legacy-road-1',
            kind: 'road',
            points: [
              { lat: 0, lon: 0 },
              { lat: 1, lon: 1 },
            ],
          },
        ],
      },
    });

    expect(parsed?.osmSnapshot?.features?.[0]?.geometryKind).toBe('line');
    expect(parsed?.osmLayerVisibility?.sidewalk).toBe(true);
    expect(parsed?.hiddenOsmFeatureIds).toContain('legacy-road-1');
  });
});

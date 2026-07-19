import type {
  StreetDesignComparisonMode,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignMapSelection,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
  StreetDesignOrigin,
  StreetDesignOsmSnapshot,
  StreetDesignPlacementDraft,
  StreetDesignPlacementSettings,
  StreetDesignPropertyValue,
  StreetDesignSelectionAddress,
  StreetDesignStateV1,
} from '../types';
import { updateObjectUnitCost } from '../logic/streetDesignCosting';
import {
  createCorridorPreview,
  createCorridorStreetDesignObject,
  createPathCorridorPreview,
  createPathCorridorStreetDesignObject,
  createPointStreetDesignObject,
  distanceBetweenPoints,
  isPathCorridorObjectType,
  rotateStreetDesignObject,
  updateCorridorWidth,
} from '../logic/streetDesignPlacement';
import {
  STREET_DESIGN_COST_CATALOG_VERSION,
  STREET_DESIGN_CURRENCY,
  getStreetDesignObjectDefinition,
} from '../logic/streetDesignObjectRegistry';
import {
  DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY,
  getStreetDesignOsmLayerVisibility,
  normalizeStreetDesignOsmSnapshot,
} from '../logic/streetDesignOsm';
import { updateStreetDesignBuildingProperties } from '../logic/streetDesignBuildingUse';

export interface StreetDesignEditorState {
  design: StreetDesignStateV1;
  selectedTool: StreetDesignObjectType;
  interactionMode: StreetDesignInteractionMode;
  selectedObjectId: string | null;
  selectedOsmWayId: string | null;
  selectedObjectFocusRequestKey: number;
  selectedOsmFocusRequestKey: number;
  hiddenObjectIds: string[];
  hiddenObjectCategories: StreetDesignObjectCategory[];
  placementDraft: StreetDesignPlacementDraft | null;
  placementSettings: StreetDesignPlacementSettings;
  isDirty: boolean;
}

export type StreetDesignEditorAction =
  | { type: 'replace_design'; design: StreetDesignStateV1; dirty?: boolean }
  | {
      type: 'set_map_context';
      mapSelection: StreetDesignMapSelection;
      selectionAddress?: StreetDesignSelectionAddress;
      invalidateOsm?: boolean;
    }
  | { type: 'set_selection_address'; selectionAddress?: StreetDesignSelectionAddress }
  | { type: 'set_osm_snapshot'; osmSnapshot: StreetDesignOsmSnapshot; origin: StreetDesignOrigin }
  | { type: 'set_comparison_mode'; comparisonMode: StreetDesignComparisonMode }
  | { type: 'set_interaction_mode'; interactionMode: StreetDesignInteractionMode }
  | {
      type: 'set_tool';
      objectType: StreetDesignObjectType;
      propertyOverrides?: Record<string, StreetDesignPropertyValue>;
      widthOverride?: number;
    }
  | {
      type: 'set_osm_layer_visibility';
      layer: keyof StreetDesignOsmLayerVisibility;
      visible: boolean;
    }
  | { type: 'set_show_street_markings'; visible: boolean }
  | { type: 'set_placement_property'; key: string; value: StreetDesignPropertyValue }
  | { type: 'set_placement_width'; width: number }
  | { type: 'set_placement_rotation'; rotationDeg: number }
  | { type: 'set_placement_unit_cost'; unitCostMinor: number | null }
  | { type: 'scene_pointer_down'; point: StreetDesignLocalPoint; id: string }
  | { type: 'scene_pointer_move'; point: StreetDesignLocalPoint }
  | { type: 'finish_placement'; id: string }
  | { type: 'finish_path_placement'; id: string }
  | { type: 'cancel_placement' }
  | { type: 'select_object'; objectId: string | null }
  | { type: 'select_osm_way'; osmWayId: string | null }
  | { type: 'set_object_visibility'; objectId: string; visible: boolean }
  | {
      type: 'set_object_category_visibility';
      category: StreetDesignObjectCategory;
      visible: boolean;
    }
  | { type: 'hide_osm_way'; osmWayId: string }
  | { type: 'import_osm_feature'; osmWayId: string; objects: StreetDesignObject[] }
  | { type: 'undo_osm_import'; osmWayId: string }
  | {
      type: 'update_object_property';
      objectId: string;
      key: string;
      value: StreetDesignPropertyValue;
    }
  | { type: 'update_object_width'; objectId: string; width: number }
  | { type: 'rotate_object'; objectId: string; rotationDeg: number }
  | { type: 'update_object_unit_cost'; objectId: string; unitCostMinor: number | null }
  | { type: 'delete_object'; objectId: string }
  | { type: 'delete_object_category'; category: StreetDesignObjectCategory };

export function createEmptyStreetDesignState(
  origin?: StreetDesignOrigin,
  currency = STREET_DESIGN_CURRENCY
): StreetDesignStateV1 {
  return {
    schemaVersion: 1,
    origin: origin ?? {
      lat: 52.520008,
      lon: 13.404954,
      label: 'Berlin Mitte',
    },
    osmSnapshot: null,
    osmLayerVisibility: DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY,
    hiddenOsmWayIds: [],
    hiddenOsmFeatureIds: [],
    showStreetMarkings: true,
    comparisonMode: 'overlay',
    currency,
    costCatalogVersion: STREET_DESIGN_COST_CATALOG_VERSION,
    objects: [],
  };
}

export function normalizeStreetDesignStateV1(design: StreetDesignStateV1): StreetDesignStateV1 {
  const hiddenOsmFeatureIds = Array.from(
    new Set([...(design.hiddenOsmWayIds ?? []), ...(design.hiddenOsmFeatureIds ?? [])])
  );

  return {
    ...design,
    osmSnapshot: normalizeStreetDesignOsmSnapshot(design.osmSnapshot),
    osmLayerVisibility: getStreetDesignOsmLayerVisibility(design.osmLayerVisibility),
    hiddenOsmWayIds: hiddenOsmFeatureIds,
    hiddenOsmFeatureIds,
  };
}

export function createInitialStreetDesignEditorState(
  design = createEmptyStreetDesignState()
): StreetDesignEditorState {
  const normalizedDesign = normalizeStreetDesignStateV1(design);

  return {
    design: normalizedDesign,
    selectedTool: 'tree',
    interactionMode: 'select',
    selectedObjectId: null,
    selectedOsmWayId: null,
    selectedObjectFocusRequestKey: 0,
    selectedOsmFocusRequestKey: 0,
    hiddenObjectIds: [],
    hiddenObjectCategories: [],
    placementDraft: null,
    placementSettings: createPlacementSettings('tree'),
    isDirty: false,
  };
}

function updateObject(
  objects: StreetDesignObject[],
  objectId: string,
  updater: (object: StreetDesignObject) => StreetDesignObject
) {
  return objects.map(object => (object.id === objectId ? updater(object) : object));
}

function getObjectCategory(object: StreetDesignObject) {
  return getStreetDesignObjectDefinition(object.type).category;
}

function showObjectCategory(categories: StreetDesignObjectCategory[], object: StreetDesignObject) {
  const category = getObjectCategory(object);
  return categories.filter(item => item !== category);
}

function getCorridorDefaultWidth(objectType: StreetDesignObjectType) {
  const definition = getStreetDesignObjectDefinition(objectType);
  return definition.defaultWidth ?? 2;
}

function updateStreetDesignObjectProperties(
  objectType: StreetDesignObjectType,
  properties: Record<string, StreetDesignPropertyValue>,
  key: string,
  value: StreetDesignPropertyValue
) {
  if (objectType === 'building') {
    return updateStreetDesignBuildingProperties(properties, key, value);
  }

  return {
    ...properties,
    [key]: value,
  };
}

function createPlacementSettings(
  objectType: StreetDesignObjectType,
  propertyOverrides?: Record<string, StreetDesignPropertyValue>,
  widthOverride?: number
): StreetDesignPlacementSettings {
  const definition = getStreetDesignObjectDefinition(objectType);
  const properties = Object.entries(propertyOverrides ?? {}).reduce(
    (currentProperties, [key, value]) =>
      updateStreetDesignObjectProperties(objectType, currentProperties, key, value),
    { ...definition.defaultProperties }
  );

  return {
    type: objectType,
    width: widthOverride ?? getCorridorDefaultWidth(objectType),
    rotationDeg: 0,
    rotationLocked: false,
    properties,
    customUnitCostMinor: null,
  };
}

function getPlacementOverrides(settings: StreetDesignPlacementSettings, currency?: string) {
  return {
    properties: settings.properties,
    customUnitCostMinor: settings.customUnitCostMinor,
    currency,
    ...(settings.rotationLocked ? { rotationDeg: settings.rotationDeg } : {}),
  };
}

function resetPlacementSettings(state: StreetDesignEditorState): StreetDesignPlacementSettings {
  return createPlacementSettings(state.selectedTool);
}

function updatePlacementDraftWidth(
  draft: StreetDesignPlacementDraft | null,
  width: number
): StreetDesignPlacementDraft | null {
  if (!draft?.preview) return draft;

  if (draft.preview.kind === 'path_corridor') {
    return {
      ...draft,
      preview: createPathCorridorPreview(
        draft.preview.points.slice(0, -1),
        draft.preview.points[draft.preview.points.length - 1] ?? draft.start,
        width
      ),
    };
  }

  return {
    ...draft,
    preview: createCorridorPreview(draft.preview.start, draft.preview.end, width),
  };
}

function getStreetDesignObjectEndpoints(object: StreetDesignObject) {
  if (object.geometry.kind === 'corridor') {
    return [object.geometry.start, object.geometry.end];
  }

  if (object.geometry.kind === 'path_corridor') {
    return [
      object.geometry.points[0],
      object.geometry.points[object.geometry.points.length - 1],
    ].filter(Boolean);
  }

  return [];
}

function snapPointToSameTypeEndpoint(args: {
  point: StreetDesignLocalPoint;
  objects: StreetDesignObject[];
  type: StreetDesignObjectType;
}) {
  const snapDistanceMeters = 2;
  let bestPoint = args.point;
  let bestDistance = snapDistanceMeters;

  args.objects.forEach(object => {
    if (object.type !== args.type) return;

    getStreetDesignObjectEndpoints(object).forEach(endpoint => {
      const distance = distanceBetweenPoints(args.point, endpoint);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPoint = endpoint;
      }
    });
  });

  return bestPoint;
}

function addFinishedPlacementObject(
  state: StreetDesignEditorState,
  object: StreetDesignObject
): StreetDesignEditorState {
  return {
    ...state,
    design: {
      ...state.design,
      objects: [...state.design.objects, object],
    },
    selectedObjectId: object.id,
    selectedOsmWayId: null,
    selectedObjectFocusRequestKey: state.selectedObjectFocusRequestKey + 1,
    hiddenObjectIds: state.hiddenObjectIds.filter(objectId => objectId !== object.id),
    hiddenObjectCategories: showObjectCategory(state.hiddenObjectCategories, object),
    placementDraft: null,
    placementSettings: resetPlacementSettings(state),
    interactionMode: 'select',
    isDirty: true,
  };
}

function finishPathPlacementDraft(
  state: StreetDesignEditorState,
  id: string
): StreetDesignEditorState {
  if (!state.placementDraft || state.placementDraft.mode !== 'path') return state;
  if (state.placementDraft.points.length < 2) return state;

  const object = createPathCorridorStreetDesignObject({
    id,
    type: state.placementDraft.type,
    points: state.placementDraft.points,
    width: state.placementSettings.width,
    overrides: getPlacementOverrides(state.placementSettings, state.design.currency),
  });

  return addFinishedPlacementObject(state, object);
}

function finishCurrentPlacementDraft(
  state: StreetDesignEditorState,
  id: string
): StreetDesignEditorState {
  if (!state.placementDraft) return state;

  if (state.placementDraft.mode === 'path') {
    return finishPathPlacementDraft(state, id);
  }

  const preview = state.placementDraft.preview;
  if (!preview || preview.kind !== 'corridor') return state;

  const object = createCorridorStreetDesignObject({
    id,
    type: state.placementDraft.type,
    start: preview.start,
    end: preview.end,
    width: preview.width,
    overrides: getPlacementOverrides(state.placementSettings, state.design.currency),
  });

  return addFinishedPlacementObject(state, object);
}

export function streetDesignReducer(
  state: StreetDesignEditorState,
  action: StreetDesignEditorAction
): StreetDesignEditorState {
  switch (action.type) {
    case 'replace_design':
      return {
        ...createInitialStreetDesignEditorState(normalizeStreetDesignStateV1(action.design)),
        selectedTool: state.selectedTool,
        placementSettings: createPlacementSettings(state.selectedTool),
        isDirty: action.dirty ?? false,
      };

    case 'set_map_context':
      return {
        ...state,
        design: {
          ...state.design,
          origin: {
            ...action.mapSelection.center,
            ...(action.selectionAddress?.formatted
              ? { label: action.selectionAddress.formatted }
              : {}),
          },
          mapSelection: action.mapSelection,
          selectionAddress: action.selectionAddress,
          ...(action.invalidateOsm
            ? {
                osmSnapshot: null,
                hiddenOsmWayIds: [],
                hiddenOsmFeatureIds: [],
              }
            : {}),
        },
        selectedOsmWayId: null,
        isDirty: true,
      };

    case 'set_selection_address':
      return {
        ...state,
        design: {
          ...state.design,
          origin: {
            ...state.design.origin,
            ...(action.selectionAddress?.formatted
              ? { label: action.selectionAddress.formatted }
              : { label: undefined }),
          },
          selectionAddress: action.selectionAddress,
        },
        isDirty: true,
      };

    case 'set_osm_snapshot':
      return {
        ...state,
        design: {
          ...state.design,
          origin: action.origin,
          osmSnapshot: normalizeStreetDesignOsmSnapshot(action.osmSnapshot),
          hiddenOsmWayIds: [],
          hiddenOsmFeatureIds: [],
        },
        selectedOsmWayId: null,
        selectedObjectFocusRequestKey: 0,
        selectedOsmFocusRequestKey: 0,
        isDirty: true,
      };

    case 'set_comparison_mode':
      return {
        ...state,
        design: {
          ...state.design,
          comparisonMode: action.comparisonMode,
        },
        isDirty: state.isDirty,
      };

    case 'set_interaction_mode':
      return {
        ...state,
        interactionMode: action.interactionMode,
        placementDraft: action.interactionMode === 'place' ? state.placementDraft : null,
        placementSettings:
          action.interactionMode === 'place'
            ? state.placementSettings
            : resetPlacementSettings(state),
      };

    case 'set_osm_layer_visibility':
      return {
        ...state,
        design: {
          ...state.design,
          osmLayerVisibility: {
            ...getStreetDesignOsmLayerVisibility(state.design.osmLayerVisibility),
            [action.layer]: action.visible,
          },
        },
        isDirty: state.isDirty,
      };

    case 'set_show_street_markings':
      return {
        ...state,
        design: {
          ...state.design,
          showStreetMarkings: action.visible,
        },
        isDirty: state.isDirty,
      };

    case 'set_tool':
      return {
        ...state,
        selectedTool: action.objectType,
        interactionMode: 'place',
        selectedObjectId: null,
        selectedOsmWayId: null,
        placementDraft: null,
        placementSettings: createPlacementSettings(
          action.objectType,
          action.propertyOverrides,
          action.widthOverride
        ),
      };

    case 'set_placement_property':
      return {
        ...state,
        placementSettings: {
          ...state.placementSettings,
          properties: updateStreetDesignObjectProperties(
            state.placementSettings.type,
            state.placementSettings.properties,
            action.key,
            action.value
          ),
        },
      };

    case 'set_placement_width':
      return {
        ...state,
        placementSettings: {
          ...state.placementSettings,
          width: action.width,
        },
        placementDraft: updatePlacementDraftWidth(state.placementDraft, action.width),
      };

    case 'set_placement_rotation':
      return {
        ...state,
        placementSettings: {
          ...state.placementSettings,
          rotationDeg: action.rotationDeg,
          rotationLocked: true,
        },
      };

    case 'set_placement_unit_cost':
      return {
        ...state,
        placementSettings: {
          ...state.placementSettings,
          customUnitCostMinor: action.unitCostMinor,
        },
      };

    case 'scene_pointer_down': {
      if (state.interactionMode !== 'place') {
        return state;
      }

      const definition = getStreetDesignObjectDefinition(state.placementSettings.type);
      const nextComparisonMode =
        state.design.comparisonMode === 'original' ? 'overlay' : state.design.comparisonMode;
      const isPathTool = isPathCorridorObjectType(state.placementSettings.type);
      const placementPoint = isPathTool
        ? snapPointToSameTypeEndpoint({
            point: action.point,
            objects: state.design.objects,
            type: state.placementSettings.type,
          })
        : action.point;

      if (isPathTool) {
        if (!state.placementDraft || state.placementDraft.mode !== 'path') {
          return {
            ...state,
            design: {
              ...state.design,
              comparisonMode: nextComparisonMode,
            },
            selectedObjectId: null,
            selectedOsmWayId: null,
            placementDraft: {
              type: state.placementSettings.type,
              mode: 'path',
              start: placementPoint,
              points: [placementPoint],
              preview: null,
            },
          };
        }

        const lastPoint =
          state.placementDraft.points[state.placementDraft.points.length - 1] ??
          state.placementDraft.start;
        if (distanceBetweenPoints(lastPoint, placementPoint) < 0.25) {
          return state;
        }

        const points = [...state.placementDraft.points, placementPoint];
        const finalPoint = points[points.length - 1] ?? placementPoint;
        return {
          ...state,
          design: {
            ...state.design,
            comparisonMode: nextComparisonMode,
          },
          selectedObjectId: null,
          selectedOsmWayId: null,
          placementDraft: {
            ...state.placementDraft,
            points,
            preview:
              points.length >= 2
                ? createPathCorridorPreview(
                    points.slice(0, -1),
                    finalPoint,
                    state.placementSettings.width
                  )
                : null,
          },
        };
      }

      if (definition.geometryKind === 'point') {
        const object = createPointStreetDesignObject({
          id: action.id,
          type: state.placementSettings.type,
          point: placementPoint,
          overrides: {
            ...getPlacementOverrides(state.placementSettings, state.design.currency),
            rotationDeg: state.placementSettings.rotationDeg,
          },
        });

        return {
          ...state,
          design: {
            ...state.design,
            comparisonMode: nextComparisonMode,
            objects: [...state.design.objects, object],
          },
          selectedObjectId: object.id,
          selectedOsmWayId: null,
          selectedObjectFocusRequestKey: state.selectedObjectFocusRequestKey + 1,
          hiddenObjectIds: state.hiddenObjectIds.filter(objectId => objectId !== object.id),
          hiddenObjectCategories: showObjectCategory(state.hiddenObjectCategories, object),
          placementDraft: null,
          placementSettings: resetPlacementSettings(state),
          interactionMode: 'select',
          isDirty: true,
        };
      }

      if (definition.geometryKind === 'corridor') {
        if (!state.placementDraft) {
          return {
            ...state,
            design: {
              ...state.design,
              comparisonMode: nextComparisonMode,
            },
            selectedObjectId: null,
            selectedOsmWayId: null,
            placementDraft: {
              type: state.placementSettings.type,
              mode: 'drag_band',
              start: placementPoint,
              points: [placementPoint],
              preview: null,
            },
          };
        }

        const object = createCorridorStreetDesignObject({
          id: action.id,
          type: state.placementDraft.type,
          start: state.placementDraft.start,
          end: placementPoint,
          width: state.placementSettings.width,
          overrides: getPlacementOverrides(state.placementSettings, state.design.currency),
        });

        return {
          ...state,
          design: {
            ...state.design,
            comparisonMode: nextComparisonMode,
            objects: [...state.design.objects, object],
          },
          selectedObjectId: object.id,
          selectedOsmWayId: null,
          selectedObjectFocusRequestKey: state.selectedObjectFocusRequestKey + 1,
          hiddenObjectIds: state.hiddenObjectIds.filter(objectId => objectId !== object.id),
          hiddenObjectCategories: showObjectCategory(state.hiddenObjectCategories, object),
          placementDraft: null,
          placementSettings: resetPlacementSettings(state),
          interactionMode: 'select',
          isDirty: true,
        };
      }

      return state;
    }

    case 'scene_pointer_move':
      if (state.interactionMode !== 'place') return state;
      if (!state.placementDraft) return state;

      if (state.placementDraft.mode === 'path') {
        const point = snapPointToSameTypeEndpoint({
          point: action.point,
          objects: state.design.objects,
          type: state.placementDraft.type,
        });

        return {
          ...state,
          placementDraft: {
            ...state.placementDraft,
            preview: createPathCorridorPreview(
              state.placementDraft.points,
              point,
              state.placementSettings.width
            ),
          },
        };
      }

      return {
        ...state,
        placementDraft: {
          ...state.placementDraft,
          preview: createCorridorPreview(
            state.placementDraft.start,
            action.point,
            state.placementSettings.width
          ),
        },
      };

    case 'finish_placement':
      return finishCurrentPlacementDraft(state, action.id);

    case 'finish_path_placement': {
      return finishPathPlacementDraft(state, action.id);
    }

    case 'cancel_placement':
      return {
        ...state,
        placementDraft: null,
        placementSettings: resetPlacementSettings(state),
        interactionMode: 'select',
      };

    case 'select_object':
      return {
        ...state,
        selectedObjectId: action.objectId,
        selectedOsmWayId: null,
        selectedObjectFocusRequestKey: action.objectId
          ? state.selectedObjectFocusRequestKey + 1
          : state.selectedObjectFocusRequestKey,
        placementDraft: null,
        placementSettings: resetPlacementSettings(state),
        interactionMode: 'select',
      };

    case 'select_osm_way':
      return {
        ...state,
        selectedObjectId: action.osmWayId ? null : state.selectedObjectId,
        selectedOsmWayId: action.osmWayId,
        selectedOsmFocusRequestKey: action.osmWayId
          ? state.selectedOsmFocusRequestKey + 1
          : state.selectedOsmFocusRequestKey,
        placementDraft: null,
        placementSettings: resetPlacementSettings(state),
        interactionMode: 'select',
      };

    case 'set_object_visibility':
      return {
        ...state,
        hiddenObjectIds: action.visible
          ? state.hiddenObjectIds.filter(objectId => objectId !== action.objectId)
          : Array.from(new Set([...state.hiddenObjectIds, action.objectId])),
        selectedObjectId:
          action.visible || state.selectedObjectId !== action.objectId
            ? state.selectedObjectId
            : null,
      };

    case 'set_object_category_visibility': {
      const selectedObject = state.design.objects.find(
        object => object.id === state.selectedObjectId
      );

      return {
        ...state,
        hiddenObjectCategories: action.visible
          ? state.hiddenObjectCategories.filter(category => category !== action.category)
          : Array.from(new Set([...state.hiddenObjectCategories, action.category])),
        selectedObjectId:
          action.visible || !selectedObject || getObjectCategory(selectedObject) !== action.category
            ? state.selectedObjectId
            : null,
      };
    }

    case 'hide_osm_way': {
      const hiddenOsmFeatureIds = Array.from(
        new Set([
          ...(state.design.hiddenOsmWayIds ?? []),
          ...(state.design.hiddenOsmFeatureIds ?? []),
          action.osmWayId,
        ])
      );

      return {
        ...state,
        design: {
          ...state.design,
          hiddenOsmWayIds: hiddenOsmFeatureIds,
          hiddenOsmFeatureIds,
        },
        selectedOsmWayId:
          state.selectedOsmWayId === action.osmWayId ? null : state.selectedOsmWayId,
        isDirty: true,
      };
    }

    case 'import_osm_feature': {
      if (action.objects.length === 0) return state;
      const firstObject = action.objects[0];

      return {
        ...state,
        design: {
          ...state.design,
          objects: [...state.design.objects, ...action.objects],
        },
        selectedObjectId: firstObject?.id ?? null,
        selectedOsmWayId: null,
        selectedObjectFocusRequestKey: firstObject
          ? state.selectedObjectFocusRequestKey + 1
          : state.selectedObjectFocusRequestKey,
        interactionMode: 'select',
        isDirty: true,
      };
    }

    case 'undo_osm_import': {
      const objects = state.design.objects.filter(
        object => object.provenance?.featureId !== action.osmWayId
      );
      if (objects.length === state.design.objects.length) return state;

      return {
        ...state,
        design: {
          ...state.design,
          objects,
        },
        selectedObjectId: null,
        isDirty: true,
      };
    }

    case 'update_object_property':
      return {
        ...state,
        design: {
          ...state.design,
          objects: updateObject(state.design.objects, action.objectId, object => ({
            ...object,
            properties: updateStreetDesignObjectProperties(
              object.type,
              object.properties,
              action.key,
              action.value
            ),
          })),
        },
        isDirty: true,
      };

    case 'update_object_width':
      return {
        ...state,
        design: {
          ...state.design,
          objects: updateObject(state.design.objects, action.objectId, object =>
            updateCorridorWidth(object, action.width)
          ),
        },
        isDirty: true,
      };

    case 'rotate_object':
      return {
        ...state,
        design: {
          ...state.design,
          objects: updateObject(state.design.objects, action.objectId, object =>
            rotateStreetDesignObject(object, action.rotationDeg)
          ),
        },
        isDirty: true,
      };

    case 'update_object_unit_cost':
      return {
        ...state,
        design: {
          ...state.design,
          objects: updateObject(state.design.objects, action.objectId, object =>
            updateObjectUnitCost(object, action.unitCostMinor)
          ),
        },
        isDirty: true,
      };

    case 'delete_object':
      return {
        ...state,
        design: {
          ...state.design,
          objects: state.design.objects.filter(object => object.id !== action.objectId),
        },
        hiddenObjectIds: state.hiddenObjectIds.filter(objectId => objectId !== action.objectId),
        selectedObjectId:
          state.selectedObjectId === action.objectId ? null : state.selectedObjectId,
        isDirty: true,
      };

    case 'delete_object_category': {
      const deletedObjectIds = new Set(
        state.design.objects
          .filter(object => getObjectCategory(object) === action.category)
          .map(object => object.id)
      );

      return {
        ...state,
        design: {
          ...state.design,
          objects: state.design.objects.filter(object => !deletedObjectIds.has(object.id)),
        },
        hiddenObjectIds: state.hiddenObjectIds.filter(objectId => !deletedObjectIds.has(objectId)),
        hiddenObjectCategories: state.hiddenObjectCategories.filter(
          category => category !== action.category
        ),
        selectedObjectId:
          state.selectedObjectId && deletedObjectIds.has(state.selectedObjectId)
            ? null
            : state.selectedObjectId,
        isDirty: deletedObjectIds.size > 0 ? true : state.isDirty,
      };
    }

    default:
      return state;
  }
}

export function parseStoredStreetDesignState(value: unknown): StreetDesignStateV1 | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<StreetDesignStateV1>;
  if (candidate.schemaVersion !== 1) return null;
  if (!candidate.origin || !Array.isArray(candidate.objects)) return null;

  return normalizeStreetDesignStateV1(candidate as StreetDesignStateV1);
}

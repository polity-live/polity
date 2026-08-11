import type {
  CityDesignComparisonMode,
  CityDesignInteractionMode,
  CityDesignLocalPoint,
  CityDesignMapSelection,
  CityDesignObject,
  CityDesignObjectCategory,
  CityDesignObjectType,
  CityDesignOsmLayerVisibility,
  CityDesignOrigin,
  CityDesignOsmSnapshot,
  CityDesignPlacementDraft,
  CityDesignPlacementSettings,
  CityDesignPropertyValue,
  CityDesignSelectionAddress,
  CityDesignStateV1,
} from '../types';
import { updateObjectUnitCost } from '../logic/cityDesignCosting';
import {
  createCorridorPreview,
  createCorridorCityDesignObject,
  createPathCorridorPreview,
  createPathCorridorCityDesignObject,
  createPointCityDesignObject,
  distanceBetweenPoints,
  isPathCorridorObjectType,
  rotateCityDesignObject,
  updateCorridorWidth,
} from '../logic/cityDesignPlacement';
import {
  CITY_DESIGN_COST_CATALOG_VERSION,
  CITY_DESIGN_CURRENCY,
  getCityDesignObjectDefinition,
} from '../logic/cityDesignObjectRegistry';
import {
  DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY,
  getCityDesignOsmLayerVisibility,
  normalizeCityDesignOsmSnapshot,
} from '../logic/cityDesignOsm';
import { updateCityDesignBuildingProperties } from '../logic/cityDesignBuildingUse';

export interface CityDesignEditorState {
  design: CityDesignStateV1;
  selectedTool: CityDesignObjectType;
  interactionMode: CityDesignInteractionMode;
  selectedObjectId: string | null;
  selectedOsmWayId: string | null;
  selectedObjectFocusRequestKey: number;
  selectedOsmFocusRequestKey: number;
  hiddenObjectIds: string[];
  hiddenObjectCategories: CityDesignObjectCategory[];
  placementDraft: CityDesignPlacementDraft | null;
  placementSettings: CityDesignPlacementSettings;
  isDirty: boolean;
}

export type CityDesignEditorAction =
  | { type: 'replace_design'; design: CityDesignStateV1; dirty?: boolean }
  | {
      type: 'set_map_context';
      mapSelection: CityDesignMapSelection;
      selectionAddress?: CityDesignSelectionAddress;
      invalidateOsm?: boolean;
    }
  | { type: 'set_selection_address'; selectionAddress?: CityDesignSelectionAddress }
  | { type: 'set_osm_snapshot'; osmSnapshot: CityDesignOsmSnapshot; origin: CityDesignOrigin }
  | { type: 'set_comparison_mode'; comparisonMode: CityDesignComparisonMode }
  | { type: 'set_interaction_mode'; interactionMode: CityDesignInteractionMode }
  | {
      type: 'set_tool';
      objectType: CityDesignObjectType;
      propertyOverrides?: Record<string, CityDesignPropertyValue>;
      widthOverride?: number;
    }
  | {
      type: 'set_osm_layer_visibility';
      layer: keyof CityDesignOsmLayerVisibility;
      visible: boolean;
    }
  | { type: 'set_show_street_markings'; visible: boolean }
  | { type: 'set_placement_property'; key: string; value: CityDesignPropertyValue }
  | { type: 'set_placement_width'; width: number }
  | { type: 'set_placement_rotation'; rotationDeg: number }
  | { type: 'set_placement_unit_cost'; unitCostMinor: number | null }
  | { type: 'scene_pointer_down'; point: CityDesignLocalPoint; id: string }
  | { type: 'scene_pointer_move'; point: CityDesignLocalPoint }
  | { type: 'finish_placement'; id: string }
  | { type: 'finish_path_placement'; id: string }
  | { type: 'cancel_placement' }
  | { type: 'select_object'; objectId: string | null }
  | { type: 'select_osm_way'; osmWayId: string | null }
  | { type: 'set_object_visibility'; objectId: string; visible: boolean }
  | {
      type: 'set_object_category_visibility';
      category: CityDesignObjectCategory;
      visible: boolean;
    }
  | { type: 'hide_osm_way'; osmWayId: string }
  | { type: 'import_osm_feature'; osmWayId: string; objects: CityDesignObject[] }
  | { type: 'undo_osm_import'; osmWayId: string }
  | {
      type: 'update_object_property';
      objectId: string;
      key: string;
      value: CityDesignPropertyValue;
    }
  | { type: 'update_object_width'; objectId: string; width: number }
  | { type: 'rotate_object'; objectId: string; rotationDeg: number }
  | { type: 'update_object_unit_cost'; objectId: string; unitCostMinor: number | null }
  | { type: 'delete_object'; objectId: string }
  | { type: 'delete_object_category'; category: CityDesignObjectCategory };

export function createEmptyCityDesignState(
  origin?: CityDesignOrigin,
  currency = CITY_DESIGN_CURRENCY
): CityDesignStateV1 {
  return {
    schemaVersion: 1,
    origin: origin ?? {
      lat: 52.520008,
      lon: 13.404954,
      label: 'Berlin Mitte',
    },
    osmSnapshot: null,
    osmLayerVisibility: DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY,
    hiddenOsmWayIds: [],
    hiddenOsmFeatureIds: [],
    showStreetMarkings: true,
    comparisonMode: 'overlay',
    currency,
    costCatalogVersion: CITY_DESIGN_COST_CATALOG_VERSION,
    objects: [],
  };
}

export function normalizeCityDesignStateV1(design: CityDesignStateV1): CityDesignStateV1 {
  const hiddenOsmFeatureIds = Array.from(
    new Set([...(design.hiddenOsmWayIds ?? []), ...(design.hiddenOsmFeatureIds ?? [])])
  );

  return {
    ...design,
    osmSnapshot: normalizeCityDesignOsmSnapshot(design.osmSnapshot),
    osmLayerVisibility: getCityDesignOsmLayerVisibility(design.osmLayerVisibility),
    hiddenOsmWayIds: hiddenOsmFeatureIds,
    hiddenOsmFeatureIds,
  };
}

export function createInitialCityDesignEditorState(
  design = createEmptyCityDesignState()
): CityDesignEditorState {
  const normalizedDesign = normalizeCityDesignStateV1(design);

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
  objects: CityDesignObject[],
  objectId: string,
  updater: (object: CityDesignObject) => CityDesignObject
) {
  return objects.map(object => (object.id === objectId ? updater(object) : object));
}

function getObjectCategory(object: CityDesignObject) {
  return getCityDesignObjectDefinition(object.type).category;
}

function showObjectCategory(categories: CityDesignObjectCategory[], object: CityDesignObject) {
  const category = getObjectCategory(object);
  return categories.filter(item => item !== category);
}

function getCorridorDefaultWidth(objectType: CityDesignObjectType) {
  const definition = getCityDesignObjectDefinition(objectType);
  return definition.defaultWidth ?? 2;
}

function updateCityDesignObjectProperties(
  objectType: CityDesignObjectType,
  properties: Record<string, CityDesignPropertyValue>,
  key: string,
  value: CityDesignPropertyValue
) {
  if (objectType === 'building') {
    return updateCityDesignBuildingProperties(properties, key, value);
  }

  return {
    ...properties,
    [key]: value,
  };
}

function createPlacementSettings(
  objectType: CityDesignObjectType,
  propertyOverrides?: Record<string, CityDesignPropertyValue>,
  widthOverride?: number
): CityDesignPlacementSettings {
  const definition = getCityDesignObjectDefinition(objectType);
  const properties = Object.entries(propertyOverrides ?? {}).reduce(
    (currentProperties, [key, value]) =>
      updateCityDesignObjectProperties(objectType, currentProperties, key, value),
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

function getPlacementOverrides(settings: CityDesignPlacementSettings, currency?: string) {
  return {
    properties: settings.properties,
    customUnitCostMinor: settings.customUnitCostMinor,
    currency,
    ...(settings.rotationLocked ? { rotationDeg: settings.rotationDeg } : {}),
  };
}

function resetPlacementSettings(state: CityDesignEditorState): CityDesignPlacementSettings {
  return createPlacementSettings(state.selectedTool);
}

function updatePlacementDraftWidth(
  draft: CityDesignPlacementDraft | null,
  width: number
): CityDesignPlacementDraft | null {
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

function getCityDesignObjectEndpoints(object: CityDesignObject) {
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
  point: CityDesignLocalPoint;
  objects: CityDesignObject[];
  type: CityDesignObjectType;
}) {
  const snapDistanceMeters = 2;
  let bestPoint = args.point;
  let bestDistance = snapDistanceMeters;

  args.objects.forEach(object => {
    if (object.type !== args.type) return;

    getCityDesignObjectEndpoints(object).forEach(endpoint => {
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
  state: CityDesignEditorState,
  object: CityDesignObject
): CityDesignEditorState {
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

function finishPathPlacementDraft(state: CityDesignEditorState, id: string): CityDesignEditorState {
  if (!state.placementDraft || state.placementDraft.mode !== 'path') return state;
  if (state.placementDraft.points.length < 2) return state;

  const object = createPathCorridorCityDesignObject({
    id,
    type: state.placementDraft.type,
    points: state.placementDraft.points,
    width: state.placementSettings.width,
    overrides: getPlacementOverrides(state.placementSettings, state.design.currency),
  });

  return addFinishedPlacementObject(state, object);
}

function finishCurrentPlacementDraft(
  state: CityDesignEditorState,
  id: string
): CityDesignEditorState {
  if (!state.placementDraft) return state;

  if (state.placementDraft.mode === 'path') {
    return finishPathPlacementDraft(state, id);
  }

  const preview = state.placementDraft.preview;
  if (!preview || preview.kind !== 'corridor') return state;

  const object = createCorridorCityDesignObject({
    id,
    type: state.placementDraft.type,
    start: preview.start,
    end: preview.end,
    width: preview.width,
    overrides: getPlacementOverrides(state.placementSettings, state.design.currency),
  });

  return addFinishedPlacementObject(state, object);
}

export function cityDesignReducer(
  state: CityDesignEditorState,
  action: CityDesignEditorAction
): CityDesignEditorState {
  switch (action.type) {
    case 'replace_design':
      return {
        ...createInitialCityDesignEditorState(normalizeCityDesignStateV1(action.design)),
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
          osmSnapshot: normalizeCityDesignOsmSnapshot(action.osmSnapshot),
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
            ...getCityDesignOsmLayerVisibility(state.design.osmLayerVisibility),
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
          properties: updateCityDesignObjectProperties(
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

      const definition = getCityDesignObjectDefinition(state.placementSettings.type);
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
        const finalPoint = points[points.length - 1] as CityDesignLocalPoint;
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
        const object = createPointCityDesignObject({
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

      {
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

        const object = createCorridorCityDesignObject({
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
      const firstObject = action.objects[0] as CityDesignObject;

      return {
        ...state,
        design: {
          ...state.design,
          objects: [...state.design.objects, ...action.objects],
        },
        selectedObjectId: firstObject.id,
        selectedOsmWayId: null,
        selectedObjectFocusRequestKey: state.selectedObjectFocusRequestKey + 1,
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
            properties: updateCityDesignObjectProperties(
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
            rotateCityDesignObject(object, action.rotationDeg)
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

export function parseStoredCityDesignState(value: unknown): CityDesignStateV1 | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CityDesignStateV1>;
  if (candidate.schemaVersion !== 1) return null;
  if (!candidate.origin || !Array.isArray(candidate.objects)) return null;

  return normalizeCityDesignStateV1(candidate as CityDesignStateV1);
}

export const cityDesignReducerInternals = {
  updateObject,
  getObjectCategory,
  showObjectCategory,
  getCorridorDefaultWidth,
  updateCityDesignObjectProperties,
  createPlacementSettings,
  getPlacementOverrides,
  resetPlacementSettings,
  updatePlacementDraftWidth,
  getCityDesignObjectEndpoints,
  snapPointToSameTypeEndpoint,
  addFinishedPlacementObject,
  finishPathPlacementDraft,
  finishCurrentPlacementDraft,
};

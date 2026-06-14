import type {
  StreetDesignComparisonMode,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
  StreetDesignOrigin,
  StreetDesignOsmSnapshot,
  StreetDesignPlacementDraft,
  StreetDesignPropertyValue,
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
  updateCorridorWidth,
} from '../logic/streetDesignPlacement';
import {
  STREET_DESIGN_COST_CATALOG_VERSION,
  STREET_DESIGN_CURRENCY,
  getStreetDesignObjectDefinition,
} from '../logic/streetDesignObjectRegistry';

export interface StreetDesignEditorState {
  design: StreetDesignStateV1;
  selectedTool: StreetDesignObjectType;
  interactionMode: StreetDesignInteractionMode;
  selectedObjectId: string | null;
  selectedOsmWayId: string | null;
  placementDraft: StreetDesignPlacementDraft | null;
  isDirty: boolean;
}

export type StreetDesignEditorAction =
  | { type: 'replace_design'; design: StreetDesignStateV1; dirty?: boolean }
  | { type: 'set_osm_snapshot'; osmSnapshot: StreetDesignOsmSnapshot; origin: StreetDesignOrigin }
  | { type: 'set_comparison_mode'; comparisonMode: StreetDesignComparisonMode }
  | { type: 'set_interaction_mode'; interactionMode: StreetDesignInteractionMode }
  | { type: 'set_tool'; objectType: StreetDesignObjectType }
  | {
      type: 'set_osm_layer_visibility';
      layer: keyof StreetDesignOsmLayerVisibility;
      visible: boolean;
    }
  | { type: 'set_show_street_markings'; visible: boolean }
  | { type: 'scene_pointer_down'; point: StreetDesignLocalPoint; id: string }
  | { type: 'scene_pointer_move'; point: StreetDesignLocalPoint }
  | { type: 'finish_path_placement'; id: string }
  | { type: 'cancel_placement' }
  | { type: 'select_object'; objectId: string | null }
  | { type: 'select_osm_way'; osmWayId: string | null }
  | { type: 'hide_osm_way'; osmWayId: string }
  | {
      type: 'update_object_property';
      objectId: string;
      key: string;
      value: StreetDesignPropertyValue;
    }
  | { type: 'update_object_width'; objectId: string; width: number }
  | { type: 'update_object_unit_cost'; objectId: string; unitCostMinor: number | null }
  | { type: 'delete_object'; objectId: string };

export function createEmptyStreetDesignState(origin?: StreetDesignOrigin): StreetDesignStateV1 {
  return {
    schemaVersion: 1,
    origin: origin ?? {
      lat: 52.520008,
      lon: 13.404954,
      label: 'Berlin Mitte',
    },
    osmSnapshot: null,
    osmLayerVisibility: {
      road: true,
      building: true,
      green: true,
      water: true,
    },
    hiddenOsmWayIds: [],
    showStreetMarkings: true,
    comparisonMode: 'overlay',
    currency: STREET_DESIGN_CURRENCY,
    costCatalogVersion: STREET_DESIGN_COST_CATALOG_VERSION,
    objects: [],
  };
}

export function createInitialStreetDesignEditorState(
  design = createEmptyStreetDesignState()
): StreetDesignEditorState {
  return {
    design,
    selectedTool: 'tree',
    interactionMode: 'place',
    selectedObjectId: null,
    selectedOsmWayId: null,
    placementDraft: null,
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

function getCorridorDefaultWidth(objectType: StreetDesignObjectType) {
  const definition = getStreetDesignObjectDefinition(objectType);
  return definition.defaultWidth ?? 2;
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

export function streetDesignReducer(
  state: StreetDesignEditorState,
  action: StreetDesignEditorAction
): StreetDesignEditorState {
  switch (action.type) {
    case 'replace_design':
      return {
        ...createInitialStreetDesignEditorState(action.design),
        selectedTool: state.selectedTool,
        isDirty: action.dirty ?? false,
      };

    case 'set_osm_snapshot':
      return {
        ...state,
        design: {
          ...state.design,
          origin: action.origin,
          osmSnapshot: action.osmSnapshot,
          hiddenOsmWayIds: [],
        },
        selectedOsmWayId: null,
        isDirty: true,
      };

    case 'set_comparison_mode':
      return {
        ...state,
        design: {
          ...state.design,
          comparisonMode: action.comparisonMode,
        },
        isDirty: true,
      };

    case 'set_interaction_mode':
      return {
        ...state,
        interactionMode: action.interactionMode,
        placementDraft: action.interactionMode === 'camera' ? null : state.placementDraft,
      };

    case 'set_osm_layer_visibility':
      return {
        ...state,
        design: {
          ...state.design,
          osmLayerVisibility: {
            road: state.design.osmLayerVisibility?.road ?? true,
            building: state.design.osmLayerVisibility?.building ?? true,
            green: state.design.osmLayerVisibility?.green ?? true,
            water: state.design.osmLayerVisibility?.water ?? true,
            [action.layer]: action.visible,
          },
        },
        isDirty: true,
      };

    case 'set_show_street_markings':
      return {
        ...state,
        design: {
          ...state.design,
          showStreetMarkings: action.visible,
        },
        isDirty: true,
      };

    case 'set_tool':
      return {
        ...state,
        selectedTool: action.objectType,
        interactionMode: 'place',
        selectedObjectId: null,
        selectedOsmWayId: null,
        placementDraft: null,
      };

    case 'scene_pointer_down': {
      if (state.interactionMode === 'camera') {
        return state;
      }

      const definition = getStreetDesignObjectDefinition(state.selectedTool);
      const nextComparisonMode =
        state.design.comparisonMode === 'original' ? 'overlay' : state.design.comparisonMode;
      const isPathTool = isPathCorridorObjectType(state.selectedTool);
      const placementPoint = isPathTool
        ? snapPointToSameTypeEndpoint({
            point: action.point,
            objects: state.design.objects,
            type: state.selectedTool,
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
              type: state.selectedTool,
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
                    getCorridorDefaultWidth(state.placementDraft.type)
                  )
                : null,
          },
        };
      }

      if (definition.geometryKind === 'point') {
        const object = createPointStreetDesignObject({
          id: action.id,
          type: state.selectedTool,
          point: placementPoint,
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
          placementDraft: null,
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
              type: state.selectedTool,
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
          width: getCorridorDefaultWidth(state.placementDraft.type),
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
          placementDraft: null,
          isDirty: true,
        };
      }

      return state;
    }

    case 'scene_pointer_move':
      if (state.interactionMode === 'camera') return state;
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
              getCorridorDefaultWidth(state.placementDraft.type)
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
            getCorridorDefaultWidth(state.placementDraft.type)
          ),
        },
      };

    case 'finish_path_placement': {
      if (!state.placementDraft || state.placementDraft.mode !== 'path') return state;
      if (state.placementDraft.points.length < 2) return state;

      const object = createPathCorridorStreetDesignObject({
        id: action.id,
        type: state.placementDraft.type,
        points: state.placementDraft.points,
        width: getCorridorDefaultWidth(state.placementDraft.type),
      });

      return {
        ...state,
        design: {
          ...state.design,
          objects: [...state.design.objects, object],
        },
        selectedObjectId: object.id,
        selectedOsmWayId: null,
        placementDraft: null,
        isDirty: true,
      };
    }

    case 'cancel_placement':
      return {
        ...state,
        placementDraft: null,
      };

    case 'select_object':
      return {
        ...state,
        selectedObjectId: action.objectId,
        selectedOsmWayId: null,
        placementDraft: null,
      };

    case 'select_osm_way':
      return {
        ...state,
        selectedObjectId: null,
        selectedOsmWayId: action.osmWayId,
        placementDraft: null,
      };

    case 'hide_osm_way':
      return {
        ...state,
        design: {
          ...state.design,
          hiddenOsmWayIds: Array.from(
            new Set([...(state.design.hiddenOsmWayIds ?? []), action.osmWayId])
          ),
        },
        selectedOsmWayId:
          state.selectedOsmWayId === action.osmWayId ? null : state.selectedOsmWayId,
        isDirty: true,
      };

    case 'update_object_property':
      return {
        ...state,
        design: {
          ...state.design,
          objects: updateObject(state.design.objects, action.objectId, object => ({
            ...object,
            properties: {
              ...object.properties,
              [action.key]: action.value,
            },
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
        selectedObjectId:
          state.selectedObjectId === action.objectId ? null : state.selectedObjectId,
        isDirty: true,
      };

    default:
      return state;
  }
}

export function parseStoredStreetDesignState(value: unknown): StreetDesignStateV1 | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<StreetDesignStateV1>;
  if (candidate.schemaVersion !== 1) return null;
  if (!candidate.origin || !Array.isArray(candidate.objects)) return null;

  return candidate as StreetDesignStateV1;
}

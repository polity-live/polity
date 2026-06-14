import type {
  StreetDesignComparisonMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectType,
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
  createPointStreetDesignObject,
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
  selectedObjectId: string | null;
  placementDraft: StreetDesignPlacementDraft | null;
  isDirty: boolean;
}

export type StreetDesignEditorAction =
  | { type: 'replace_design'; design: StreetDesignStateV1; dirty?: boolean }
  | { type: 'set_osm_snapshot'; osmSnapshot: StreetDesignOsmSnapshot; origin: StreetDesignOrigin }
  | { type: 'set_comparison_mode'; comparisonMode: StreetDesignComparisonMode }
  | { type: 'set_tool'; objectType: StreetDesignObjectType }
  | { type: 'scene_pointer_down'; point: StreetDesignLocalPoint; id: string }
  | { type: 'scene_pointer_move'; point: StreetDesignLocalPoint }
  | { type: 'select_object'; objectId: string | null }
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
    selectedObjectId: null,
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
  return definition.geometryKind === 'corridor' ? (definition.defaultWidth ?? 2) : 2;
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
        },
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

    case 'set_tool':
      return {
        ...state,
        selectedTool: action.objectType,
        selectedObjectId: null,
        placementDraft: null,
      };

    case 'scene_pointer_down': {
      const definition = getStreetDesignObjectDefinition(state.selectedTool);

      if (definition.geometryKind === 'point') {
        const object = createPointStreetDesignObject({
          id: action.id,
          type: state.selectedTool,
          point: action.point,
        });

        return {
          ...state,
          design: {
            ...state.design,
            objects: [...state.design.objects, object],
          },
          selectedObjectId: object.id,
          placementDraft: null,
          isDirty: true,
        };
      }

      if (definition.geometryKind === 'corridor') {
        if (!state.placementDraft) {
          return {
            ...state,
            selectedObjectId: null,
            placementDraft: {
              type: state.selectedTool,
              start: action.point,
              preview: null,
            },
          };
        }

        const object = createCorridorStreetDesignObject({
          id: action.id,
          type: state.placementDraft.type,
          start: state.placementDraft.start,
          end: action.point,
          width: getCorridorDefaultWidth(state.placementDraft.type),
        });

        return {
          ...state,
          design: {
            ...state.design,
            objects: [...state.design.objects, object],
          },
          selectedObjectId: object.id,
          placementDraft: null,
          isDirty: true,
        };
      }

      return state;
    }

    case 'scene_pointer_move':
      if (!state.placementDraft) return state;

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

    case 'select_object':
      return {
        ...state,
        selectedObjectId: action.objectId,
        placementDraft: null,
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

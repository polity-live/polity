import { useCallback, useMemo, useReducer } from 'react';
import type {
  StreetDesignComparisonMode,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignMapSelection,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
  StreetDesignPropertyValue,
  StreetDesignSelectionAddress,
  StreetDesignStateV1,
} from '../types';
import { getStreetDesignCostLine, getStreetDesignCostSummary } from '../logic/streetDesignCosting';
import { getStreetDesignOsmFeatures } from '../logic/streetDesignOsm';
import { convertStreetDesignOsmFeature } from '../logic/streetDesignOsmConversion';
import {
  createInitialStreetDesignEditorState,
  streetDesignReducer,
} from '../state/streetDesignReducer';

function createObjectId() {
  return crypto.randomUUID();
}

export function useStreetDesignEditorState(initialDesign: StreetDesignStateV1) {
  const [state, dispatch] = useReducer(
    streetDesignReducer,
    initialDesign,
    createInitialStreetDesignEditorState
  );

  const selectedObject = useMemo(
    () => state.design.objects.find(object => object.id === state.selectedObjectId) ?? null,
    [state.design.objects, state.selectedObjectId]
  );
  const selectedOsmWay = useMemo(
    () =>
      getStreetDesignOsmFeatures(state.design.osmSnapshot).find(
        feature => feature.id === state.selectedOsmWayId
      ) ?? null,
    [state.design.osmSnapshot, state.selectedOsmWayId]
  );

  const costSummary = useMemo(
    () => getStreetDesignCostSummary(state.design.objects, state.design.currency),
    [state.design.currency, state.design.objects]
  );

  const selectedObjectCostLine = useMemo(
    () => (selectedObject ? getStreetDesignCostLine(selectedObject) : null),
    [selectedObject]
  );

  const replaceDesign = useCallback((design: StreetDesignStateV1, dirty = false) => {
    dispatch({ type: 'replace_design', design, dirty });
  }, []);

  const updateMapContext = useCallback(
    (
      mapSelection: StreetDesignMapSelection,
      selectionAddress?: StreetDesignSelectionAddress,
      invalidateOsm = true
    ) => {
      dispatch({
        type: 'set_map_context',
        mapSelection,
        selectionAddress,
        invalidateOsm,
      });
    },
    []
  );

  const updateSelectionAddress = useCallback((selectionAddress?: StreetDesignSelectionAddress) => {
    dispatch({ type: 'set_selection_address', selectionAddress });
  }, []);

  const setComparisonMode = useCallback((comparisonMode: StreetDesignComparisonMode) => {
    dispatch({ type: 'set_comparison_mode', comparisonMode });
  }, []);

  const setInteractionMode = useCallback((interactionMode: StreetDesignInteractionMode) => {
    dispatch({ type: 'set_interaction_mode', interactionMode });
  }, []);

  const setSelectedTool = useCallback(
    (
      objectType: StreetDesignObjectType,
      propertyOverrides?: Record<string, StreetDesignPropertyValue>,
      widthOverride?: number
    ) => {
      dispatch({ type: 'set_tool', objectType, propertyOverrides, widthOverride });
    },
    []
  );

  const setOsmLayerVisibility = useCallback(
    (layer: keyof StreetDesignOsmLayerVisibility, visible: boolean) => {
      dispatch({ type: 'set_osm_layer_visibility', layer, visible });
    },
    []
  );

  const setShowStreetMarkings = useCallback((visible: boolean) => {
    dispatch({ type: 'set_show_street_markings', visible });
  }, []);

  const updatePlacementProperty = useCallback((key: string, value: StreetDesignPropertyValue) => {
    dispatch({ type: 'set_placement_property', key, value });
  }, []);

  const updatePlacementWidth = useCallback((width: number) => {
    dispatch({ type: 'set_placement_width', width });
  }, []);

  const updatePlacementRotation = useCallback((rotationDeg: number) => {
    dispatch({ type: 'set_placement_rotation', rotationDeg });
  }, []);

  const updatePlacementUnitCost = useCallback((unitCostMinor: number | null) => {
    dispatch({ type: 'set_placement_unit_cost', unitCostMinor });
  }, []);

  const handleScenePointerDown = useCallback((point: StreetDesignLocalPoint) => {
    dispatch({ type: 'scene_pointer_down', point, id: createObjectId() });
  }, []);

  const handleScenePointerMove = useCallback((point: StreetDesignLocalPoint) => {
    dispatch({ type: 'scene_pointer_move', point });
  }, []);

  const finishPathPlacement = useCallback(() => {
    dispatch({ type: 'finish_path_placement', id: createObjectId() });
  }, []);

  const finishPlacement = useCallback(() => {
    dispatch({ type: 'finish_placement', id: createObjectId() });
  }, []);

  const cancelPlacement = useCallback(() => {
    dispatch({ type: 'cancel_placement' });
  }, []);

  const selectObject = useCallback((objectId: string | null) => {
    dispatch({ type: 'select_object', objectId });
  }, []);

  const selectOsmWay = useCallback((osmWayId: string | null) => {
    dispatch({ type: 'select_osm_way', osmWayId });
  }, []);

  const setObjectVisibility = useCallback((objectId: string, visible: boolean) => {
    dispatch({ type: 'set_object_visibility', objectId, visible });
  }, []);

  const setObjectCategoryVisibility = useCallback(
    (category: StreetDesignObjectCategory, visible: boolean) => {
      dispatch({ type: 'set_object_category_visibility', category, visible });
    },
    []
  );

  const hideOsmWay = useCallback((osmWayId: string) => {
    dispatch({ type: 'hide_osm_way', osmWayId });
  }, []);

  const importOsmWay = useCallback(
    (osmWayId: string) => {
      const feature = getStreetDesignOsmFeatures(state.design.osmSnapshot).find(
        item => item.id === osmWayId
      );
      if (!feature) return;
      const objects = convertStreetDesignOsmFeature({
        feature,
        origin: state.design.origin,
        createId: createObjectId,
        currency: state.design.currency,
      });
      dispatch({ type: 'import_osm_feature', osmWayId, objects });
    },
    [state.design.currency, state.design.origin, state.design.osmSnapshot]
  );

  const undoOsmImport = useCallback((osmWayId: string) => {
    dispatch({ type: 'undo_osm_import', osmWayId });
  }, []);

  const updateObjectProperty = useCallback(
    (objectId: string, key: string, value: StreetDesignPropertyValue) => {
      dispatch({ type: 'update_object_property', objectId, key, value });
    },
    []
  );

  const updateObjectWidth = useCallback((objectId: string, width: number) => {
    dispatch({ type: 'update_object_width', objectId, width });
  }, []);

  const rotateObject = useCallback((objectId: string, rotationDeg: number) => {
    dispatch({ type: 'rotate_object', objectId, rotationDeg });
  }, []);

  const updateObjectUnitCost = useCallback((objectId: string, unitCostMinor: number | null) => {
    dispatch({ type: 'update_object_unit_cost', objectId, unitCostMinor });
  }, []);

  const deleteObject = useCallback((objectId: string) => {
    dispatch({ type: 'delete_object', objectId });
  }, []);

  const deleteObjectCategory = useCallback((category: StreetDesignObjectCategory) => {
    dispatch({ type: 'delete_object_category', category });
  }, []);

  return {
    state,
    design: state.design,
    interactionMode: state.interactionMode,
    placementSettings: state.placementSettings,
    selectedObject,
    selectedOsmWay,
    selectedObjectCostLine,
    costSummary,
    replaceDesign,
    updateMapContext,
    updateSelectionAddress,
    setComparisonMode,
    setInteractionMode,
    setSelectedTool,
    setOsmLayerVisibility,
    setShowStreetMarkings,
    updatePlacementProperty,
    updatePlacementWidth,
    updatePlacementRotation,
    updatePlacementUnitCost,
    handleScenePointerDown,
    handleScenePointerMove,
    finishPlacement,
    finishPathPlacement,
    cancelPlacement,
    selectObject,
    selectOsmWay,
    setObjectVisibility,
    setObjectCategoryVisibility,
    hideOsmWay,
    importOsmWay,
    undoOsmImport,
    updateObjectProperty,
    updateObjectWidth,
    rotateObject,
    updateObjectUnitCost,
    deleteObject,
    deleteObjectCategory,
  };
}

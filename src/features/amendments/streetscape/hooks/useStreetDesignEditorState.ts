import { useCallback, useMemo, useReducer } from 'react';
import type {
  StreetDesignComparisonMode,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
  StreetDesignPropertyValue,
  StreetDesignStateV1,
} from '../types';
import { getStreetDesignCostLine, getStreetDesignCostSummary } from '../logic/streetDesignCosting';
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
    () => state.design.osmSnapshot?.ways.find(way => way.id === state.selectedOsmWayId) ?? null,
    [state.design.osmSnapshot?.ways, state.selectedOsmWayId]
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

  const setComparisonMode = useCallback((comparisonMode: StreetDesignComparisonMode) => {
    dispatch({ type: 'set_comparison_mode', comparisonMode });
  }, []);

  const setInteractionMode = useCallback((interactionMode: StreetDesignInteractionMode) => {
    dispatch({ type: 'set_interaction_mode', interactionMode });
  }, []);

  const setSelectedTool = useCallback((objectType: StreetDesignObjectType) => {
    dispatch({ type: 'set_tool', objectType });
  }, []);

  const setOsmLayerVisibility = useCallback(
    (layer: keyof StreetDesignOsmLayerVisibility, visible: boolean) => {
      dispatch({ type: 'set_osm_layer_visibility', layer, visible });
    },
    []
  );

  const setShowStreetMarkings = useCallback((visible: boolean) => {
    dispatch({ type: 'set_show_street_markings', visible });
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

  const cancelPlacement = useCallback(() => {
    dispatch({ type: 'cancel_placement' });
  }, []);

  const selectObject = useCallback((objectId: string | null) => {
    dispatch({ type: 'select_object', objectId });
  }, []);

  const selectOsmWay = useCallback((osmWayId: string | null) => {
    dispatch({ type: 'select_osm_way', osmWayId });
  }, []);

  const hideOsmWay = useCallback((osmWayId: string) => {
    dispatch({ type: 'hide_osm_way', osmWayId });
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

  const updateObjectUnitCost = useCallback((objectId: string, unitCostMinor: number | null) => {
    dispatch({ type: 'update_object_unit_cost', objectId, unitCostMinor });
  }, []);

  const deleteObject = useCallback((objectId: string) => {
    dispatch({ type: 'delete_object', objectId });
  }, []);

  return {
    state,
    design: state.design,
    interactionMode: state.interactionMode,
    selectedObject,
    selectedOsmWay,
    selectedObjectCostLine,
    costSummary,
    replaceDesign,
    setComparisonMode,
    setInteractionMode,
    setSelectedTool,
    setOsmLayerVisibility,
    setShowStreetMarkings,
    handleScenePointerDown,
    handleScenePointerMove,
    finishPathPlacement,
    cancelPlacement,
    selectObject,
    selectOsmWay,
    hideOsmWay,
    updateObjectProperty,
    updateObjectWidth,
    updateObjectUnitCost,
    deleteObject,
  };
}

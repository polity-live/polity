import { useCallback, useMemo, useReducer } from 'react';
import type {
  StreetDesignComparisonMode,
  StreetDesignLocalPoint,
  StreetDesignObjectType,
  StreetDesignPropertyValue,
  StreetDesignStateV1,
} from '../types';
import { getStreetDesignCostSummary } from '../logic/streetDesignCosting';
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

  const costSummary = useMemo(
    () => getStreetDesignCostSummary(state.design.objects, state.design.currency),
    [state.design.currency, state.design.objects]
  );

  const replaceDesign = useCallback((design: StreetDesignStateV1, dirty = false) => {
    dispatch({ type: 'replace_design', design, dirty });
  }, []);

  const setComparisonMode = useCallback((comparisonMode: StreetDesignComparisonMode) => {
    dispatch({ type: 'set_comparison_mode', comparisonMode });
  }, []);

  const setSelectedTool = useCallback((objectType: StreetDesignObjectType) => {
    dispatch({ type: 'set_tool', objectType });
  }, []);

  const handleScenePointerDown = useCallback((point: StreetDesignLocalPoint) => {
    dispatch({ type: 'scene_pointer_down', point, id: createObjectId() });
  }, []);

  const handleScenePointerMove = useCallback((point: StreetDesignLocalPoint) => {
    dispatch({ type: 'scene_pointer_move', point });
  }, []);

  const selectObject = useCallback((objectId: string | null) => {
    dispatch({ type: 'select_object', objectId });
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
    selectedObject,
    costSummary,
    replaceDesign,
    setComparisonMode,
    setSelectedTool,
    handleScenePointerDown,
    handleScenePointerMove,
    selectObject,
    updateObjectProperty,
    updateObjectWidth,
    updateObjectUnitCost,
    deleteObject,
  };
}

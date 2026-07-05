import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignStateV1,
} from '../types';
interface StreetSceneCanvasViewProps {
  design: StreetDesignStateV1;
  metricLabels?: string[];
  isLoadingOsm: boolean;
  placementPreview: CorridorGeometry | PathCorridorGeometry | null;
  placementPreviewType: StreetDesignObjectType | null;
  placementStart: StreetDesignLocalPoint | null;
  placementMode: 'drag_band' | 'path' | null;
  placementPointCount: number;
  canFinishPathPlacement: boolean;
  selectedObjectId: string | null;
  selectedObject: StreetDesignObject | null;
  selectedObjectFocusRequestKey: number;
  hiddenObjectIds: string[];
  hiddenObjectCategories: StreetDesignObjectCategory[];
  selectedOsmWayId: string | null;
  selectedOsmFocusRequestKey: number;
  interactionMode: StreetDesignInteractionMode;
  readOnly: boolean;
  onPointerDown: (point: StreetDesignLocalPoint) => void;
  onPointerMove: (point: StreetDesignLocalPoint) => void;
  onFinishPlacement: () => void;
  onFinishPathPlacement: () => void;
  onCancelPlacement: () => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onObjectRotate: (objectId: string, rotationDeg: number) => void;
  onDeleteObject: (objectId: string) => void;
}

import { useStreetSceneCanvasViewController } from './useStreetSceneCanvasViewController';
import { StreetSceneCanvasViewView } from './StreetSceneCanvasViewView';

export function StreetSceneCanvasView({
  design,
  metricLabels,
  isLoadingOsm,
  placementPreview,
  placementPreviewType,
  placementStart,
  placementMode,
  placementPointCount,
  canFinishPathPlacement,
  selectedObjectId,
  selectedObject,
  selectedObjectFocusRequestKey,
  hiddenObjectIds,
  hiddenObjectCategories,
  selectedOsmWayId,
  selectedOsmFocusRequestKey,
  interactionMode,
  readOnly,
  onPointerDown,
  onPointerMove,
  onFinishPlacement,
  onFinishPathPlacement,
  onCancelPlacement,
  onObjectSelect,
  onOsmWaySelect,
  onObjectRotate,
  onDeleteObject,
}: StreetSceneCanvasViewProps) {
  const viewProps = useStreetSceneCanvasViewController({
    design,
    metricLabels,
    isLoadingOsm,
    placementPreview,
    placementPreviewType,
    placementStart,
    placementMode,
    placementPointCount,
    canFinishPathPlacement,
    selectedObjectId,
    selectedObject,
    selectedObjectFocusRequestKey,
    hiddenObjectIds,
    hiddenObjectCategories,
    selectedOsmWayId,
    selectedOsmFocusRequestKey,
    interactionMode,
    readOnly,
    onPointerDown,
    onPointerMove,
    onFinishPlacement,
    onFinishPathPlacement,
    onCancelPlacement,
    onObjectSelect,
    onOsmWaySelect,
    onObjectRotate,
    onDeleteObject,
  });

  return <StreetSceneCanvasViewView {...viewProps} />;
}

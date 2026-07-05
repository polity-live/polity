import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignInteractionMode,
  StreetDesignCostLine,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmWay,
  StreetDesignPropertyValue,
  StreetDesignStateV1,
} from '../types';
import type { StreetDesignChangeRequest } from '../logic/streetDesignChangeRequests';
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
  selectedObjectCostLine: StreetDesignCostLine | null;
  selectedObjectFocusRequestKey: number;
  hiddenObjectIds: string[];
  hiddenObjectCategories: StreetDesignObjectCategory[];
  selectedOsmWayId: string | null;
  selectedOsmWay: StreetDesignOsmWay | null;
  selectedOsmFocusRequestKey: number;
  interactionMode: StreetDesignInteractionMode;
  readOnly: boolean;
  changeRequests?: readonly StreetDesignChangeRequest[];
  selectedChangeRequestId?: string | null;
  showChangeRequests?: boolean;
  onPointerDown: (point: StreetDesignLocalPoint) => void;
  onPointerMove: (point: StreetDesignLocalPoint) => void;
  onFinishPlacement: () => void;
  onFinishPathPlacement: () => void;
  onCancelPlacement: () => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onObjectVisibilityChange: (objectId: string, visible: boolean) => void;
  onOsmWayHide: (osmWayId: string) => void;
  onObjectRotate: (objectId: string, rotationDeg: number) => void;
  onPropertyChange: (objectId: string, key: string, value: StreetDesignPropertyValue) => void;
  onWidthChange: (objectId: string, width: number) => void;
  onRotationChange: (objectId: string, rotationDeg: number) => void;
  onUnitCostChange: (objectId: string, unitCostMinor: number | null) => void;
  onDeleteObject: (objectId: string) => void;
  onChangeRequestSelect?: (changeRequestId: string | null) => void;
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
  selectedObjectCostLine,
  selectedObjectFocusRequestKey,
  hiddenObjectIds,
  hiddenObjectCategories,
  selectedOsmWayId,
  selectedOsmWay,
  selectedOsmFocusRequestKey,
  interactionMode,
  readOnly,
  changeRequests = [],
  selectedChangeRequestId = null,
  showChangeRequests = false,
  onPointerDown,
  onPointerMove,
  onFinishPlacement,
  onFinishPathPlacement,
  onCancelPlacement,
  onObjectSelect,
  onOsmWaySelect,
  onObjectVisibilityChange,
  onOsmWayHide,
  onObjectRotate,
  onPropertyChange,
  onWidthChange,
  onRotationChange,
  onUnitCostChange,
  onDeleteObject,
  onChangeRequestSelect,
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
    selectedObjectCostLine,
    selectedObjectFocusRequestKey,
    hiddenObjectIds,
    hiddenObjectCategories,
    selectedOsmWayId,
    selectedOsmWay,
    selectedOsmFocusRequestKey,
    interactionMode,
    readOnly,
    changeRequests,
    selectedChangeRequestId,
    showChangeRequests,
    onPointerDown,
    onPointerMove,
    onFinishPlacement,
    onFinishPathPlacement,
    onCancelPlacement,
    onObjectSelect,
    onOsmWaySelect,
    onObjectVisibilityChange,
    onOsmWayHide,
    onObjectRotate,
    onPropertyChange,
    onWidthChange,
    onRotationChange,
    onUnitCostChange,
    onDeleteObject,
    onChangeRequestSelect,
  });

  return <StreetSceneCanvasViewView {...viewProps} />;
}

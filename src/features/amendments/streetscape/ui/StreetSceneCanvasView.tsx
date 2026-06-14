import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectType,
  StreetDesignStateV1,
} from '../types';
interface StreetSceneCanvasViewProps {
  design: StreetDesignStateV1;
  placementPreview: CorridorGeometry | PathCorridorGeometry | null;
  placementPreviewType: StreetDesignObjectType | null;
  placementStart: StreetDesignLocalPoint | null;
  placementMode: 'drag_band' | 'path' | null;
  placementPointCount: number;
  canFinishPathPlacement: boolean;
  selectedObjectId: string | null;
  selectedObject: StreetDesignObject | null;
  selectedOsmWayId: string | null;
  interactionMode: StreetDesignInteractionMode;
  readOnly: boolean;
  onPointerDown: (point: StreetDesignLocalPoint) => void;
  onPointerMove: (point: StreetDesignLocalPoint) => void;
  onFinishPathPlacement: () => void;
  onCancelPlacement: () => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onDeleteObject: (objectId: string) => void;
}

import { useStreetSceneCanvasViewController } from './useStreetSceneCanvasViewController';
import { StreetSceneCanvasViewView } from './StreetSceneCanvasViewView';

export function StreetSceneCanvasView({
  design,
  placementPreview,
  placementPreviewType,
  placementStart,
  placementMode,
  placementPointCount,
  canFinishPathPlacement,
  selectedObjectId,
  selectedObject,
  selectedOsmWayId,
  interactionMode,
  readOnly,
  onPointerDown,
  onPointerMove,
  onFinishPathPlacement,
  onCancelPlacement,
  onObjectSelect,
  onOsmWaySelect,
  onDeleteObject,
}: StreetSceneCanvasViewProps) {
  const viewProps = useStreetSceneCanvasViewController({
    design,
    placementPreview,
    placementPreviewType,
    placementStart,
    placementMode,
    placementPointCount,
    canFinishPathPlacement,
    selectedObjectId,
    selectedObject,
    selectedOsmWayId,
    interactionMode,
    readOnly,
    onPointerDown,
    onPointerMove,
    onFinishPathPlacement,
    onCancelPlacement,
    onObjectSelect,
    onOsmWaySelect,
    onDeleteObject,
  });

  return <StreetSceneCanvasViewView {...viewProps} />;
}

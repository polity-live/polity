import type {
  CorridorGeometry,
  PathCorridorGeometry,
  CityDesignInteractionMode,
  CityDesignComparisonLayer,
  CityDesignCostLine,
  CityDesignCameraPose,
  CityDesignLocalPoint,
  CityDesignObject,
  CityDesignObjectCategory,
  CityDesignObjectType,
  CityDesignOsmWay,
  CityDesignPropertyValue,
  CityDesignStateV1,
} from '../types';
import type {
  CityDesignChangeRequest,
  CityDesignChangeRequestColorMode,
} from '../logic/cityDesignChangeRequests';
import type { CityDesignDiscussionLike } from './CityDesignChangeRequestPanel';
import type { EditorCollaborator } from '@/features/editor/types';
import type { CityDesignRemoteCursor } from '../hooks/useCityDesignRemoteCursors';
interface StreetSceneCanvasViewProps {
  design: CityDesignStateV1;
  metricLabels?: string[];
  initialLegendOpen?: boolean;
  embeddedPreview?: boolean;
  embeddedWorkspace?: boolean;
  initialCameraPose?: CityDesignCameraPose;
  isLoadingOsm: boolean;
  placementPreview: CorridorGeometry | PathCorridorGeometry | null;
  placementPreviewType: CityDesignObjectType | null;
  placementStart: CityDesignLocalPoint | null;
  placementMode: 'drag_band' | 'path' | null;
  placementPointCount: number;
  canFinishPathPlacement: boolean;
  selectedObjectId: string | null;
  selectedObject: CityDesignObject | null;
  selectedObjectCostLine: CityDesignCostLine | null;
  selectedObjectFocusRequestKey: number;
  hiddenObjectIds: string[];
  hiddenObjectCategories: CityDesignObjectCategory[];
  selectedOsmWayId: string | null;
  selectedOsmWay: CityDesignOsmWay | null;
  selectedOsmFocusRequestKey: number;
  interactionMode: CityDesignInteractionMode;
  readOnly: boolean;
  mapContextReadOnly?: boolean;
  changeRequests?: readonly CityDesignChangeRequest[];
  cityDesignDiscussions?: readonly CityDesignDiscussionLike[];
  selectedChangeRequestId?: string | null;
  showChangeRequests?: boolean;
  changeRequestColorMode?: CityDesignChangeRequestColorMode;
  canVoteOnChangeRequests?: boolean;
  canFinalizeChangeRequests?: boolean;
  currentUserId?: string | null;
  currentUserDisplayName?: string | null;
  currentUserAvatarUrl?: string | null;
  collaborators?: readonly EditorCollaborator[];
  remoteCursors?: readonly CityDesignRemoteCursor[];
  onPointerDown: (point: CityDesignLocalPoint) => void;
  onPointerMove: (point: CityDesignLocalPoint) => void;
  onPointerHover?: (point: CityDesignLocalPoint | null, layer: CityDesignComparisonLayer) => void;
  onFinishPlacement: () => void;
  onFinishPathPlacement: () => void;
  onCancelPlacement: () => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onObjectVisibilityChange: (objectId: string, visible: boolean) => void;
  onOsmWayHide: (osmWayId: string) => void;
  onOsmWayImport?: (osmWayId: string) => void;
  onOsmImportUndo?: (osmWayId: string) => void;
  onObjectRotate: (objectId: string, rotationDeg: number) => void;
  onPropertyChange: (objectId: string, key: string, value: CityDesignPropertyValue) => void;
  onWidthChange: (objectId: string, width: number) => void;
  onRotationChange: (objectId: string, rotationDeg: number) => void;
  onUnitCostChange: (objectId: string, unitCostMinor: number | null) => void;
  onDeleteObject: (objectId: string) => void;
  onChangeRequestSelect?: (changeRequestId: string | null) => void;
  onChangeRequestVote?: (
    changeRequestId: string,
    vote: 'accept' | 'reject' | 'abstain'
  ) => void | Promise<void>;
  onChangeRequestFinalize?: (changeRequestId: string) => void | Promise<void>;
  onChangeRequestTitleChange?: (changeRequestId: string, title: string) => void | Promise<void>;
  onChangeRequestCommentSubmit?: (changeRequestId: string, text: string) => void | Promise<void>;
}

import { useStreetSceneCanvasViewController } from './useStreetSceneCanvasViewController';
import { StreetSceneCanvasViewView } from './StreetSceneCanvasViewView';

export function StreetSceneCanvasView({
  design,
  metricLabels,
  initialLegendOpen = false,
  embeddedPreview = false,
  embeddedWorkspace = false,
  initialCameraPose,
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
  mapContextReadOnly = readOnly,
  changeRequests = [],
  cityDesignDiscussions = [],
  selectedChangeRequestId = null,
  showChangeRequests = false,
  changeRequestColorMode = 'natural',
  canVoteOnChangeRequests = false,
  canFinalizeChangeRequests = false,
  currentUserId = null,
  currentUserDisplayName = null,
  currentUserAvatarUrl = null,
  collaborators = [],
  remoteCursors = [],
  onPointerDown,
  onPointerMove,
  onPointerHover = () => undefined,
  onFinishPlacement,
  onFinishPathPlacement,
  onCancelPlacement,
  onObjectSelect,
  onOsmWaySelect,
  onObjectVisibilityChange,
  onOsmWayHide,
  onOsmWayImport = () => undefined,
  onOsmImportUndo = () => undefined,
  onObjectRotate,
  onPropertyChange,
  onWidthChange,
  onRotationChange,
  onUnitCostChange,
  onDeleteObject,
  onChangeRequestSelect,
  onChangeRequestVote,
  onChangeRequestFinalize,
  onChangeRequestTitleChange,
  onChangeRequestCommentSubmit,
}: StreetSceneCanvasViewProps) {
  const viewProps = useStreetSceneCanvasViewController({
    design,
    metricLabels,
    initialLegendOpen,
    embeddedPreview,
    embeddedWorkspace,
    initialCameraPose,
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
    mapContextReadOnly,
    changeRequests,
    cityDesignDiscussions,
    selectedChangeRequestId,
    showChangeRequests,
    changeRequestColorMode,
    canVoteOnChangeRequests,
    canFinalizeChangeRequests,
    currentUserId,
    currentUserDisplayName,
    currentUserAvatarUrl,
    collaborators,
    remoteCursors,
    onPointerDown,
    onPointerMove,
    onPointerHover,
    onFinishPlacement,
    onFinishPathPlacement,
    onCancelPlacement,
    onObjectSelect,
    onOsmWaySelect,
    onObjectVisibilityChange,
    onOsmWayHide,
    onOsmWayImport,
    onOsmImportUndo,
    onObjectRotate,
    onPropertyChange,
    onWidthChange,
    onRotationChange,
    onUnitCostChange,
    onDeleteObject,
    onChangeRequestSelect,
    onChangeRequestVote,
    onChangeRequestFinalize,
    onChangeRequestTitleChange,
    onChangeRequestCommentSubmit,
  });

  return <StreetSceneCanvasViewView {...viewProps} />;
}

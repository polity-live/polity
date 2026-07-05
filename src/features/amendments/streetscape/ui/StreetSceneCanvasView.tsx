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
import type {
  StreetDesignChangeRequest,
  StreetDesignChangeRequestColorMode,
} from '../logic/streetDesignChangeRequests';
import type { StreetDesignDiscussionLike } from './StreetDesignChangeRequestPanel';
import type { EditorCollaborator } from '@/features/editor/types';
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
  streetDesignDiscussions?: readonly StreetDesignDiscussionLike[];
  selectedChangeRequestId?: string | null;
  showChangeRequests?: boolean;
  changeRequestColorMode?: StreetDesignChangeRequestColorMode;
  canVoteOnChangeRequests?: boolean;
  canFinalizeChangeRequests?: boolean;
  currentUserId?: string | null;
  currentUserDisplayName?: string | null;
  currentUserAvatarUrl?: string | null;
  collaborators?: readonly EditorCollaborator[];
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
  streetDesignDiscussions = [],
  selectedChangeRequestId = null,
  showChangeRequests = false,
  changeRequestColorMode = 'natural',
  canVoteOnChangeRequests = false,
  canFinalizeChangeRequests = false,
  currentUserId = null,
  currentUserDisplayName = null,
  currentUserAvatarUrl = null,
  collaborators = [],
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
  onChangeRequestVote,
  onChangeRequestFinalize,
  onChangeRequestTitleChange,
  onChangeRequestCommentSubmit,
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
    streetDesignDiscussions,
    selectedChangeRequestId,
    showChangeRequests,
    changeRequestColorMode,
    canVoteOnChangeRequests,
    canFinalizeChangeRequests,
    currentUserId,
    currentUserDisplayName,
    currentUserAvatarUrl,
    collaborators,
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
    onChangeRequestVote,
    onChangeRequestFinalize,
    onChangeRequestTitleChange,
    onChangeRequestCommentSubmit,
  });

  return <StreetSceneCanvasViewView {...viewProps} />;
}

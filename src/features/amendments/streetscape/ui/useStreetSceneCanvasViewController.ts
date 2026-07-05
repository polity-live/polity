import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignCostLine,
  StreetDesignCameraPose,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmWay,
  StreetDesignPropertyValue,
  StreetDesignStateV1,
} from '../types';
import {
  mountStreetDesignScene,
  type StreetDesignSceneController,
  type StreetDesignSceneMountOptions,
} from '../logic/streetDesignScene';
import type {
  StreetDesignChangeRequest,
  StreetDesignChangeRequestColorMode,
} from '../logic/streetDesignChangeRequests';
import type { EditorCollaborator } from '@/features/editor/types';
import type { StreetDesignDiscussionLike } from './StreetDesignChangeRequestPanel';

const EMPTY_CHANGE_REQUESTS: readonly StreetDesignChangeRequest[] = [];

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

export function useStreetSceneCanvasViewController({
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneControllerRef = useRef<StreetDesignSceneController | null>(null);
  const cameraPoseRef = useRef<StreetDesignCameraPose | null>(null);
  const lastObjectFocusRequestKeyRef = useRef(0);
  const lastOsmFocusRequestKeyRef = useRef(0);
  const latestFocusRequestRef = useRef({
    selectedObjectId,
    selectedObjectFocusRequestKey,
    selectedOsmWayId,
    selectedOsmFocusRequestKey,
  });
  latestFocusRequestRef.current = {
    selectedObjectId,
    selectedObjectFocusRequestKey,
    selectedOsmWayId,
    selectedOsmFocusRequestKey,
  };

  const [loadFailed, setLoadFailed] = useState(false);
  const renderedChangeRequests = showChangeRequests ? changeRequests : EMPTY_CHANGE_REQUESTS;
  const latestSceneOptionsRef = useRef<Omit<StreetDesignSceneMountOptions, 'canvas'>>({
    design,
    placementPreview,
    placementPreviewType,
    placementStart,
    selectedObjectId,
    selectedOsmWayId,
    selectedChangeRequestId,
    hiddenObjectIds,
    hiddenObjectCategories,
    changeRequests: renderedChangeRequests,
    changeRequestColorMode,
    focusObjectId: null,
    focusOsmWayId: null,
    interactionMode,
    readOnly,
    initialCameraPose: cameraPoseRef.current,
    onPointerDown,
    onPointerMove,
    onObjectSelect,
    onOsmWaySelect,
    onObjectRotate,
    onCameraPoseChange: pose => {
      cameraPoseRef.current = pose;
    },
  });
  latestSceneOptionsRef.current = {
    design,
    placementPreview,
    placementPreviewType,
    placementStart,
    selectedObjectId,
    selectedOsmWayId,
    selectedChangeRequestId,
    hiddenObjectIds,
    hiddenObjectCategories,
    changeRequests: renderedChangeRequests,
    changeRequestColorMode,
    focusObjectId: null,
    focusOsmWayId: null,
    interactionMode,
    readOnly,
    initialCameraPose: cameraPoseRef.current,
    onPointerDown,
    onPointerMove,
    onObjectSelect,
    onOsmWaySelect,
    onObjectRotate,
    onCameraPoseChange: pose => {
      cameraPoseRef.current = pose;
    },
  };

  useEffect(() => {
    if (readOnly || interactionMode !== 'place' || !placementMode) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableKeyboardTarget(event.target)) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelPlacement();
        return;
      }

      const canFinishPlacement =
        placementMode === 'drag_band' || (placementMode === 'path' && canFinishPathPlacement);
      if (event.key === 'Enter' && canFinishPlacement) {
        event.preventDefault();
        onFinishPlacement();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    canFinishPathPlacement,
    interactionMode,
    onCancelPlacement,
    onFinishPlacement,
    placementMode,
    readOnly,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let controller: StreetDesignSceneController | null = null;
    let isActive = true;
    const mountedSceneOptions = latestSceneOptionsRef.current;
    const { focusObjectId, focusOsmWayId } = consumeFocusRequests({
      latestFocusRequest: latestFocusRequestRef.current,
      lastObjectFocusRequestKeyRef,
      lastOsmFocusRequestKeyRef,
    });

    mountStreetDesignScene({
      canvas,
      ...mountedSceneOptions,
      initialCameraPose: cameraPoseRef.current,
      focusObjectId,
      focusOsmWayId,
    })
      .then(nextController => {
        if (!isActive) {
          nextController.dispose();
          return;
        }
        controller = nextController;
        sceneControllerRef.current = nextController;
        if (latestSceneOptionsRef.current !== mountedSceneOptions) {
          syncSceneController(nextController, latestSceneOptionsRef.current);
        }
      })
      .catch(() => {
        if (isActive) setLoadFailed(true);
      });

    return () => {
      isActive = false;
      sceneControllerRef.current = null;
      controller?.dispose();
    };
  }, []);

  useEffect(() => {
    sceneControllerRef.current?.updateHandlers({
      onPointerDown,
      onPointerMove,
      onObjectSelect,
      onOsmWaySelect,
      onObjectRotate,
      onCameraPoseChange: latestSceneOptionsRef.current.onCameraPoseChange,
    });
  }, [onObjectRotate, onObjectSelect, onOsmWaySelect, onPointerDown, onPointerMove]);

  useEffect(() => {
    sceneControllerRef.current?.updateDesign({
      design,
      hiddenObjectIds,
      hiddenObjectCategories,
    });
  }, [design, hiddenObjectCategories, hiddenObjectIds]);

  useEffect(() => {
    const controller = sceneControllerRef.current;
    if (!controller) return;

    const { focusObjectId, focusOsmWayId } = consumeFocusRequests({
      latestFocusRequest: latestFocusRequestRef.current,
      lastObjectFocusRequestKeyRef,
      lastOsmFocusRequestKeyRef,
    });
    controller.updateSelection({
      selectedObjectId,
      selectedOsmWayId,
      selectedChangeRequestId,
      focusObjectId,
      focusOsmWayId,
      interactionMode,
      readOnly,
    });
  }, [
    interactionMode,
    readOnly,
    selectedChangeRequestId,
    selectedObjectFocusRequestKey,
    selectedObjectId,
    selectedOsmFocusRequestKey,
    selectedOsmWayId,
  ]);

  useEffect(() => {
    sceneControllerRef.current?.updatePlacementPreview({
      placementPreview,
      placementPreviewType,
      placementStart,
    });
  }, [placementPreview, placementPreviewType, placementStart]);

  useEffect(() => {
    sceneControllerRef.current?.updateChangeRequests({
      changeRequests: renderedChangeRequests,
      selectedChangeRequestId: latestSceneOptionsRef.current.selectedChangeRequestId,
      changeRequestColorMode,
    });
  }, [changeRequestColorMode, renderedChangeRequests]);

  useEffect(() => {
    sceneControllerRef.current?.updateInteractionMode({
      interactionMode,
      readOnly,
    });
  }, [interactionMode, readOnly]);

  return {
    design,
    metricLabels,
    isLoadingOsm,
    placementMode,
    placementPointCount,
    canFinishPathPlacement,
    selectedObject,
    selectedObjectCostLine,
    selectedOsmWay,
    hiddenObjectIds,
    hiddenObjectCategories,
    interactionMode,
    readOnly,
    changeRequests,
    streetDesignDiscussions,
    selectedChangeRequestId,
    showChangeRequests,
    canVoteOnChangeRequests,
    canFinalizeChangeRequests,
    currentUserId,
    currentUserDisplayName,
    currentUserAvatarUrl,
    collaborators,
    onFinishPathPlacement,
    onCancelPlacement,
    onObjectSelect,
    onOsmWaySelect,
    onObjectVisibilityChange,
    onOsmWayHide,
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
    canvasRef,
    loadFailed,
  };
}

function syncSceneController(
  controller: StreetDesignSceneController,
  options: Omit<StreetDesignSceneMountOptions, 'canvas'>
) {
  controller.updateHandlers({
    onPointerDown: options.onPointerDown,
    onPointerMove: options.onPointerMove,
    onObjectSelect: options.onObjectSelect,
    onOsmWaySelect: options.onOsmWaySelect,
    onObjectRotate: options.onObjectRotate,
    onCameraPoseChange: options.onCameraPoseChange,
  });
  controller.updateDesign({
    design: options.design,
    hiddenObjectIds: options.hiddenObjectIds,
    hiddenObjectCategories: options.hiddenObjectCategories,
  });
  controller.updateSelection({
    selectedObjectId: options.selectedObjectId,
    selectedOsmWayId: options.selectedOsmWayId,
    selectedChangeRequestId: options.selectedChangeRequestId,
    focusObjectId: null,
    focusOsmWayId: null,
    interactionMode: options.interactionMode,
    readOnly: options.readOnly,
  });
  controller.updatePlacementPreview({
    placementPreview: options.placementPreview,
    placementPreviewType: options.placementPreviewType,
    placementStart: options.placementStart,
  });
  controller.updateChangeRequests({
    changeRequests: options.changeRequests,
    selectedChangeRequestId: options.selectedChangeRequestId,
    changeRequestColorMode: options.changeRequestColorMode,
  });
  controller.updateInteractionMode({
    interactionMode: options.interactionMode,
    readOnly: options.readOnly,
  });
}

function consumeFocusRequests({
  latestFocusRequest,
  lastObjectFocusRequestKeyRef,
  lastOsmFocusRequestKeyRef,
}: {
  latestFocusRequest: {
    selectedObjectId: string | null;
    selectedObjectFocusRequestKey: number;
    selectedOsmWayId: string | null;
    selectedOsmFocusRequestKey: number;
  };
  lastObjectFocusRequestKeyRef: MutableRefObject<number>;
  lastOsmFocusRequestKeyRef: MutableRefObject<number>;
}) {
  const focusObjectId =
    latestFocusRequest.selectedObjectId &&
    latestFocusRequest.selectedObjectFocusRequestKey !== lastObjectFocusRequestKeyRef.current
      ? latestFocusRequest.selectedObjectId
      : null;
  const focusOsmWayId =
    latestFocusRequest.selectedOsmWayId &&
    latestFocusRequest.selectedOsmFocusRequestKey !== lastOsmFocusRequestKeyRef.current
      ? latestFocusRequest.selectedOsmWayId
      : null;

  if (focusObjectId) {
    lastObjectFocusRequestKeyRef.current = latestFocusRequest.selectedObjectFocusRequestKey;
  }
  if (focusOsmWayId) {
    lastOsmFocusRequestKeyRef.current = latestFocusRequest.selectedOsmFocusRequestKey;
  }

  return { focusObjectId, focusOsmWayId };
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest('input, textarea, select, button, [contenteditable="true"], [role="textbox"]')
  );
}

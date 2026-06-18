import { useEffect, useRef, useState } from 'react';
import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignCameraPose,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignStateV1,
} from '../types';
import { mountStreetDesignScene } from '../logic/streetDesignScene';
interface StreetSceneCanvasViewProps {
  design: StreetDesignStateV1;
  metricLabels?: string[];
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

export function useStreetSceneCanvasViewController({
  design,
  metricLabels,
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraPoseRef = useRef<StreetDesignCameraPose | null>(null);
  const lastObjectFocusRequestKeyRef = useRef(0);
  const lastOsmFocusRequestKeyRef = useRef(0);

  const [loadFailed, setLoadFailed] = useState(false);

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

    let cleanup: (() => void) | undefined;
    let isActive = true;
    const focusObjectId =
      selectedObjectId && selectedObjectFocusRequestKey !== lastObjectFocusRequestKeyRef.current
        ? selectedObjectId
        : null;
    const focusOsmWayId =
      selectedOsmWayId && selectedOsmFocusRequestKey !== lastOsmFocusRequestKeyRef.current
        ? selectedOsmWayId
        : null;

    if (focusObjectId) {
      lastObjectFocusRequestKeyRef.current = selectedObjectFocusRequestKey;
    }
    if (focusOsmWayId) {
      lastOsmFocusRequestKeyRef.current = selectedOsmFocusRequestKey;
    }

    mountStreetDesignScene({
      canvas,
      design,
      placementPreview,
      placementPreviewType,
      placementStart,
      selectedObjectId,
      selectedOsmWayId,
      hiddenObjectIds,
      hiddenObjectCategories,
      focusObjectId,
      focusOsmWayId,
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
    })
      .then(nextCleanup => {
        if (!isActive) {
          nextCleanup();
          return;
        }
        cleanup = nextCleanup;
      })
      .catch(() => {
        if (isActive) setLoadFailed(true);
      });

    return () => {
      isActive = false;
      cleanup?.();
    };
  }, [
    design,
    interactionMode,
    onObjectSelect,
    onOsmWaySelect,
    onObjectRotate,
    onPointerDown,
    onPointerMove,
    placementPreview,
    placementPreviewType,
    placementStart,
    readOnly,
    selectedObjectId,
    selectedObjectFocusRequestKey,
    hiddenObjectIds,
    hiddenObjectCategories,
    selectedOsmWayId,
    selectedOsmFocusRequestKey,
  ]);

  return {
    design,
    metricLabels,
    placementMode,
    placementPointCount,
    canFinishPathPlacement,
    selectedObject,
    interactionMode,
    readOnly,
    onFinishPathPlacement,
    onCancelPlacement,
    onDeleteObject,
    canvasRef,
    loadFailed,
  };
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest('input, textarea, select, button, [contenteditable="true"], [role="textbox"]')
  );
}

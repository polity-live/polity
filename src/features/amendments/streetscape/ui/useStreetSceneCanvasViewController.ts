import { useEffect, useRef, useState } from 'react';
import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignCameraPose,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectType,
  StreetDesignStateV1,
} from '../types';
import { mountStreetDesignScene } from '../logic/streetDesignScene';
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
  onFinishPlacement: () => void;
  onFinishPathPlacement: () => void;
  onCancelPlacement: () => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onDeleteObject: (objectId: string) => void;
}

export function useStreetSceneCanvasViewController({
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
  onFinishPlacement,
  onFinishPathPlacement,
  onCancelPlacement,
  onObjectSelect,
  onOsmWaySelect,
  onDeleteObject,
}: StreetSceneCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraPoseRef = useRef<StreetDesignCameraPose | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (readOnly || !placementMode) return undefined;

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
  }, [canFinishPathPlacement, onCancelPlacement, onFinishPlacement, placementMode, readOnly]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let cleanup: (() => void) | undefined;
    let isActive = true;

    mountStreetDesignScene({
      canvas,
      design,
      placementPreview,
      placementPreviewType,
      placementStart,
      selectedObjectId,
      selectedOsmWayId,
      interactionMode,
      readOnly,
      initialCameraPose: cameraPoseRef.current,
      onPointerDown,
      onPointerMove,
      onObjectSelect,
      onOsmWaySelect,
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
    onPointerDown,
    onPointerMove,
    placementPreview,
    placementPreviewType,
    placementStart,
    readOnly,
    selectedObjectId,
    selectedOsmWayId,
  ]);

  return {
    design,
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

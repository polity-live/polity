import { useEffect, useRef, useState } from 'react';
import type { CorridorGeometry, StreetDesignLocalPoint, StreetDesignStateV1 } from '../types';
import { mountStreetDesignScene } from '../logic/streetDesignScene';
interface StreetSceneCanvasViewProps {
  design: StreetDesignStateV1;
  placementPreview: CorridorGeometry | null;
  selectedObjectId: string | null;
  readOnly: boolean;
  onPointerDown: (point: StreetDesignLocalPoint) => void;
  onPointerMove: (point: StreetDesignLocalPoint) => void;
  onObjectSelect: (objectId: string | null) => void;
}

export function useStreetSceneCanvasViewController({
  design,
  placementPreview,
  selectedObjectId,
  readOnly,
  onPointerDown,
  onPointerMove,
  onObjectSelect,
}: StreetSceneCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let cleanup: (() => void) | undefined;
    let isActive = true;

    mountStreetDesignScene({
      canvas,
      design,
      placementPreview,
      selectedObjectId,
      readOnly,
      onPointerDown,
      onPointerMove,
      onObjectSelect,
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
    onObjectSelect,
    onPointerDown,
    onPointerMove,
    placementPreview,
    readOnly,
    selectedObjectId,
  ]);

  return {
    design,
    placementPreview,
    selectedObjectId,
    readOnly,
    onPointerDown,
    onPointerMove,
    onObjectSelect,
    canvasRef,
    loadFailed,
    setLoadFailed,
  };
}

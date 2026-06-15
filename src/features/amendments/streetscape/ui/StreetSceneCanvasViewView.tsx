import type { RefObject } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import type {
  StreetDesignInteractionMode,
  StreetDesignObject,
  StreetDesignStateV1,
} from '../types';
import { getStreetDesignObjectDefinition } from '../logic/streetDesignObjectRegistry';

export interface StreetSceneCanvasViewViewProps {
  design: StreetDesignStateV1;
  placementMode: 'drag_band' | 'path' | null;
  placementPointCount: number;
  canFinishPathPlacement: boolean;
  selectedObject: StreetDesignObject | null;
  interactionMode: StreetDesignInteractionMode;
  readOnly: boolean;
  onFinishPathPlacement: () => void;
  onCancelPlacement: () => void;
  onDeleteObject: (objectId: string) => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  loadFailed: boolean;
}

export function StreetSceneCanvasViewView({
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
}: StreetSceneCanvasViewViewProps) {
  if (loadFailed) {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground flex min-h-[560px] items-center justify-center rounded-md border text-sm">
        Three.js konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div className="border-border bg-muted/20 relative min-h-[560px] overflow-hidden rounded-md border">
      <canvas
        ref={canvasRef}
        className={
          interactionMode === 'camera'
            ? 'h-[560px] w-full cursor-grab'
            : 'h-[560px] w-full cursor-crosshair'
        }
      />
      <div className="pointer-events-none absolute top-3 left-3 flex gap-2 text-xs font-medium">
        {design.comparisonMode === 'split' ? (
          <>
            <span className="bg-background/90 rounded-md border px-2 py-1 shadow-sm">Original</span>
            <span className="bg-background/90 rounded-md border px-2 py-1 shadow-sm">
              Neues Design
            </span>
          </>
        ) : (
          <span className="bg-background/90 rounded-md border px-2 py-1 shadow-sm">
            {design.comparisonMode === 'original'
              ? 'Original'
              : design.comparisonMode === 'new_design'
                ? 'Neues Design'
                : 'Overlay'}
          </span>
        )}
      </div>
      {placementMode === 'path' ? (
        <div className="border-border bg-background/95 absolute bottom-3 left-3 flex items-center gap-3 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur">
          <div>
            <p className="font-semibold">Kurve zeichnen</p>
            <p className="text-muted-foreground">{placementPointCount} Punkte gesetzt</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={readOnly || !canFinishPathPlacement}
            onClick={onFinishPathPlacement}
          >
            Fertig
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            disabled={readOnly}
            onClick={onCancelPlacement}
          >
            Abbrechen
          </Button>
        </div>
      ) : null}
      {selectedObject ? (
        <div className="border-border bg-background/95 absolute right-3 bottom-3 flex items-center gap-3 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur">
          <div>
            <p className="font-semibold">
              {getStreetDesignObjectDefinition(selectedObject.type).label}
            </p>
            <p className="text-muted-foreground">{selectedObject.id.slice(0, 8)}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8 gap-2 px-2 text-xs"
            disabled={readOnly}
            onClick={() => onDeleteObject(selectedObject.id)}
          >
            <Trash2 className="size-3.5" />
            Entfernen
          </Button>
        </div>
      ) : null}
    </div>
  );
}

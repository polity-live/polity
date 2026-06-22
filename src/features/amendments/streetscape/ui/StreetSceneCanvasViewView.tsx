import type { RefObject } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type {
  StreetDesignInteractionMode,
  StreetDesignObject,
  StreetDesignStateV1,
} from '../types';
import { getStreetDesignObjectDefinition } from '../logic/streetDesignObjectRegistry';

export interface StreetSceneCanvasViewViewProps {
  design: StreetDesignStateV1;
  metricLabels?: string[];
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
  metricLabels = [],
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
  const { t } = useTranslation();

  if (loadFailed) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex min-h-[28rem] items-center justify-center border-b p-4 text-sm xl:border-r xl:border-b-0">
        {t('features.amendments.streetscape.canvas.loadFailed')}
      </div>
    );
  }

  const comparisonLabel = t(
    `features.amendments.streetscape.comparison.${
      design.comparisonMode === 'new_design' ? 'newDesign' : design.comparisonMode
    }`
  );
  const modeLabel = t(`features.amendments.streetscape.modes.${interactionMode}`);

  return (
    <div
      className="from-background via-muted/20 to-muted/50 relative min-h-[30rem] overflow-hidden border-b bg-gradient-to-br p-3 xl:border-r xl:border-b-0"
      data-swipe-lock
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(20,184,166,0.16),transparent_22%),radial-gradient(circle_at_82%_12%,rgba(234,179,8,0.12),transparent_20%)]" />
      <div className="bg-background/40 relative overflow-hidden rounded-md border shadow-inner">
        <canvas
          ref={canvasRef}
          className={
            interactionMode === 'camera'
              ? 'h-[30rem] w-full cursor-grab sm:h-[34rem] 2xl:h-[38rem]'
              : interactionMode === 'select'
                ? 'h-[30rem] w-full cursor-pointer sm:h-[34rem] 2xl:h-[38rem]'
                : 'h-[30rem] w-full cursor-crosshair sm:h-[34rem] 2xl:h-[38rem]'
          }
        />
      </div>
      <div className="pointer-events-none absolute top-6 right-6 left-6 flex flex-wrap items-start justify-between gap-2 text-xs font-medium">
        <span className="bg-background/90 rounded-md border px-3 py-1.5 shadow-sm backdrop-blur">
          {comparisonLabel} · {modeLabel}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          {metricLabels.map(label => (
            <span
              key={label}
              className="bg-background/90 rounded-full border px-3 py-1.5 shadow-sm backdrop-blur"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      {placementMode === 'path' ? (
        <div className="border-border bg-background/95 absolute bottom-6 left-6 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur">
          <div>
            <p className="font-semibold">{t('features.amendments.streetscape.canvas.drawPath')}</p>
            <p className="text-muted-foreground">
              {t('features.amendments.streetscape.canvas.pointsSet', {
                count: placementPointCount,
              })}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={readOnly || !canFinishPathPlacement}
            onClick={onFinishPathPlacement}
          >
            {t('common.done')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            disabled={readOnly}
            onClick={onCancelPlacement}
          >
            {t('common.actions.cancel')}
          </Button>
        </div>
      ) : null}
      {selectedObject ? (
        <div className="border-border bg-background/95 absolute right-6 bottom-6 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur">
          <div>
            <p className="font-semibold">
              {t(getStreetDesignObjectDefinition(selectedObject.type).labelKey)}
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
            {t('features.amendments.streetscape.actions.removeShort')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

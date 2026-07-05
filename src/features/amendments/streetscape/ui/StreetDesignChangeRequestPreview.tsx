import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/features/shared/utils/utils';

import {
  mountStreetDesignScene,
  type StreetDesignSceneController,
} from '../logic/streetDesignScene';
import {
  getStreetDesignChangeRequestStreetDesignId,
  type StreetDesignChangeRequest,
  type StreetDesignChangeRequestColorMode,
  type StreetDesignPreviewSource,
} from '../logic/streetDesignChangeRequests';
import { resolveStreetDesignBaseState } from '../logic/streetDesignChangeRequestDiff';
import { parseStoredStreetDesignState } from '../state/streetDesignReducer';
import type { StreetDesignStateV1 } from '../types';

interface StreetDesignChangeRequestPreviewProps {
  changeRequest: StreetDesignChangeRequest;
  streetDesigns?: readonly StreetDesignPreviewSource[];
  colorMode?: StreetDesignChangeRequestColorMode;
  className?: string;
}

export function StreetDesignChangeRequestPreview({
  changeRequest,
  streetDesigns = [],
  colorMode = 'natural',
  className,
}: StreetDesignChangeRequestPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const design = useMemo(
    () => resolveStreetDesignPreviewState(changeRequest, streetDesigns),
    [changeRequest, streetDesigns]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let controller: StreetDesignSceneController | undefined;
    let isActive = true;

    mountStreetDesignScene({
      canvas,
      design,
      placementPreview: null,
      placementPreviewType: null,
      placementStart: null,
      selectedObjectId: null,
      selectedOsmWayId: null,
      selectedChangeRequestId: changeRequest.id,
      hiddenObjectIds: [],
      hiddenObjectCategories: [],
      changeRequests: [changeRequest],
      changeRequestColorMode: colorMode,
      focusObjectId: null,
      focusOsmWayId: null,
      interactionMode: 'camera',
      readOnly: true,
      initialCameraPose: null,
      onPointerDown: () => undefined,
      onPointerMove: () => undefined,
      onObjectSelect: () => undefined,
      onOsmWaySelect: () => undefined,
      onObjectRotate: () => undefined,
      onCameraPoseChange: () => undefined,
    })
      .then(nextController => {
        if (!isActive) {
          nextController.dispose();
          return;
        }
        controller = nextController;
      })
      .catch(() => {
        if (isActive) setLoadFailed(true);
      });

    return () => {
      isActive = false;
      controller?.dispose();
    };
  }, [changeRequest, colorMode, design]);

  return (
    <div
      className={cn('bg-muted/20 relative h-72 overflow-hidden rounded-md border', className)}
      data-testid="street-design-change-request-preview"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {loadFailed ? (
        <div className="bg-background/85 text-muted-foreground absolute inset-0 flex items-center justify-center px-4 text-center text-sm">
          Street design preview unavailable.
        </div>
      ) : null}
    </div>
  );
}

export function resolveStreetDesignPreviewState(
  changeRequest: StreetDesignChangeRequest,
  streetDesigns: readonly StreetDesignPreviewSource[]
): StreetDesignStateV1 {
  const targetStreetDesignId = getStreetDesignChangeRequestStreetDesignId(changeRequest);
  const matchingStreetDesign =
    (targetStreetDesignId
      ? streetDesigns.find(streetDesign => streetDesign.id === targetStreetDesignId)
      : null) ??
    streetDesigns[0] ??
    null;
  const storedState = matchingStreetDesign
    ? parseStoredStreetDesignState(
        matchingStreetDesign.design_state ?? matchingStreetDesign.designState
      )
    : null;

  return resolveStreetDesignBaseState(
    changeRequest.new_properties ?? changeRequest.original_properties,
    storedState ?? undefined
  );
}

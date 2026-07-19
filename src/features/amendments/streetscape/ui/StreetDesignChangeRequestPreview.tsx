import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';

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
import {
  getStreetDesignCostChange,
  resolveStreetDesignBaseState,
} from '../logic/streetDesignChangeRequestDiff';
import { ConvertedCurrencyAmount } from '@/features/shared/ui/currency';
import { minorToMajor } from '@/features/shared/logic/currency';
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
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const design = useMemo(
    () => resolveStreetDesignPreviewState(changeRequest, streetDesigns),
    [changeRequest, streetDesigns]
  );
  const costChange = useMemo(
    () =>
      getStreetDesignCostChange(changeRequest.original_properties, changeRequest.new_properties),
    [changeRequest.new_properties, changeRequest.original_properties]
  );
  const hasVisibleCostChange = Boolean(
    costChange &&
    (costChange.beforeUnitCostMinor !== costChange.afterUnitCostMinor ||
      costChange.beforeTotalCostMinor !== costChange.afterTotalCostMinor)
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
      onPointerHover: () => undefined,
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
      className={cn('bg-muted/20 overflow-hidden rounded-md border', className)}
      data-testid="street-design-change-request-preview"
    >
      <div className="relative h-72">
        <canvas ref={canvasRef} className="block h-full w-full" />
        {loadFailed ? (
          <div className="bg-background/85 text-muted-foreground absolute inset-0 flex items-center justify-center px-4 text-center text-sm">
            Street design preview unavailable.
          </div>
        ) : null}
      </div>
      {hasVisibleCostChange && costChange ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 border-t px-3 py-3 text-sm">
          <CostColumn
            label={t('features.amendments.streetscape.changeRequests.before')}
            unitCostMinor={costChange.beforeUnitCostMinor}
            totalCostMinor={costChange.beforeTotalCostMinor}
            currency={design.currency}
            t={t}
          />
          <span className="text-muted-foreground self-center">→</span>
          <CostColumn
            label={t('features.amendments.streetscape.changeRequests.after')}
            unitCostMinor={costChange.afterUnitCostMinor}
            totalCostMinor={costChange.afterTotalCostMinor}
            currency={design.currency}
            t={t}
          />
        </div>
      ) : null}
    </div>
  );
}

function CostColumn({
  label,
  unitCostMinor,
  totalCostMinor,
  currency,
  t,
}: {
  label: string;
  unitCostMinor: number | null;
  totalCostMinor: number | null;
  currency: string;
  t: (key: string) => string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="truncate font-medium">
        {t('features.amendments.streetscape.inspector.price')}:{' '}
        {unitCostMinor == null ? (
          '—'
        ) : (
          <ConvertedCurrencyAmount
            amount={minorToMajor(unitCostMinor, currency)}
            currency={currency}
          />
        )}
      </p>
      <p className="text-muted-foreground truncate text-xs">
        {t('features.amendments.streetscape.inspector.total')}:{' '}
        {totalCostMinor == null ? (
          '—'
        ) : (
          <ConvertedCurrencyAmount
            amount={minorToMajor(totalCostMinor, currency)}
            currency={currency}
          />
        )}
      </p>
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

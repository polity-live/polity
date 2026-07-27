import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';

import { mountCityDesignScene, type CityDesignSceneController } from '../logic/cityDesignScene';
import {
  getCityDesignChangeRequestCityDesignId,
  type CityDesignChangeRequest,
  type CityDesignChangeRequestColorMode,
  type CityDesignPreviewSource,
} from '../logic/cityDesignChangeRequests';
import {
  getCityDesignCostChange,
  resolveCityDesignBaseState,
} from '../logic/cityDesignChangeRequestDiff';
import { ConvertedCurrencyAmount } from '@/features/shared/ui/currency';
import { minorToMajor } from '@/features/shared/logic/currency';
import { parseStoredCityDesignState } from '../state/cityDesignReducer';
import type { CityDesignStateV1 } from '../types';

interface CityDesignChangeRequestPreviewProps {
  changeRequest: CityDesignChangeRequest;
  cityDesigns?: readonly CityDesignPreviewSource[];
  colorMode?: CityDesignChangeRequestColorMode;
  className?: string;
}

export function CityDesignChangeRequestPreview({
  changeRequest,
  cityDesigns = [],
  colorMode = 'natural',
  className,
}: CityDesignChangeRequestPreviewProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const design = useMemo(
    () => resolveCityDesignPreviewState(changeRequest, cityDesigns),
    [changeRequest, cityDesigns]
  );
  const costChange = useMemo(
    () => getCityDesignCostChange(changeRequest.original_properties, changeRequest.new_properties),
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

    let controller: CityDesignSceneController | undefined;
    let isActive = true;

    mountCityDesignScene({
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
      data-testid="city-design-change-request-preview"
    >
      <div className="relative h-72">
        <canvas ref={canvasRef} className="block h-full w-full" />
        {loadFailed ? (
          <div className="bg-background/85 text-muted-foreground absolute inset-0 flex items-center justify-center px-4 text-center text-sm">
            {t('features.amendments.cityDesignPreviewUnavailable')}
          </div>
        ) : null}
      </div>
      {hasVisibleCostChange && costChange ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 border-t px-3 py-3 text-sm">
          <CostColumn
            label={t('features.amendments.cityDesign.changeRequests.before')}
            unitCostMinor={costChange.beforeUnitCostMinor}
            totalCostMinor={costChange.beforeTotalCostMinor}
            currency={design.currency}
            t={t}
          />
          <span className="text-muted-foreground self-center">→</span>
          <CostColumn
            label={t('features.amendments.cityDesign.changeRequests.after')}
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
        {t('features.amendments.cityDesign.inspector.price')}:{' '}
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
        {t('features.amendments.cityDesign.inspector.total')}:{' '}
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

export function resolveCityDesignPreviewState(
  changeRequest: CityDesignChangeRequest,
  cityDesigns: readonly CityDesignPreviewSource[]
): CityDesignStateV1 {
  const targetCityDesignId = getCityDesignChangeRequestCityDesignId(changeRequest);
  const matchingCityDesign =
    (targetCityDesignId
      ? cityDesigns.find(cityDesign => cityDesign.id === targetCityDesignId)
      : null) ??
    cityDesigns[0] ??
    null;
  const storedState = matchingCityDesign
    ? parseStoredCityDesignState(matchingCityDesign.design_state ?? matchingCityDesign.designState)
    : null;

  return resolveCityDesignBaseState(
    changeRequest.new_properties ?? changeRequest.original_properties,
    storedState ?? undefined
  );
}

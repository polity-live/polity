import { useMemo, useState, type RefObject } from 'react';
import { ChevronDown, Layers, Trash2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { LoadingProgressBar } from '@/features/shared/ui/feedback';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import type {
  StreetDesignInteractionMode,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignStateV1,
} from '../types';
import {
  buildStreetDesignLegendSections,
  type StreetDesignLegendEntry,
} from '../logic/streetDesignLegend';
import { getStreetDesignObjectDefinition } from '../logic/streetDesignObjectRegistry';
import { getStreetDesignObjectVariantLabelKey } from '../logic/streetDesignVariantCatalog';

export interface StreetSceneCanvasViewViewProps {
  design: StreetDesignStateV1;
  metricLabels?: string[];
  isLoadingOsm: boolean;
  placementMode: 'drag_band' | 'path' | null;
  placementPointCount: number;
  canFinishPathPlacement: boolean;
  selectedObject: StreetDesignObject | null;
  hiddenObjectIds?: readonly string[];
  hiddenObjectCategories?: readonly StreetDesignObjectCategory[];
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
  isLoadingOsm,
  placementMode,
  placementPointCount,
  canFinishPathPlacement,
  selectedObject,
  hiddenObjectIds = [],
  hiddenObjectCategories = [],
  interactionMode,
  readOnly,
  onFinishPathPlacement,
  onCancelPlacement,
  onDeleteObject,
  canvasRef,
  loadFailed,
}: StreetSceneCanvasViewViewProps) {
  const { t } = useTranslation();
  const [legendOpen, setLegendOpen] = useState(true);
  const legendSections = useMemo(
    () =>
      buildStreetDesignLegendSections({
        design,
        hiddenObjectIds,
        hiddenObjectCategories,
      }),
    [design, hiddenObjectCategories, hiddenObjectIds]
  );

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
        {isLoadingOsm ? (
          <div className="pointer-events-none absolute right-4 bottom-4 left-4 z-10">
            <LoadingProgressBar
              motionStyle="optimistic"
              ariaLabel={t('features.amendments.streetscape.canvas.loadingOsm')}
              className="bg-background/75 ring-border/80 h-2 shadow-sm ring-1 backdrop-blur"
            />
          </div>
        ) : null}
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
      {legendSections.length > 0 ? (
        <Collapsible
          open={legendOpen}
          onOpenChange={setLegendOpen}
          className="bg-background/95 pointer-events-auto absolute top-24 right-6 z-10 w-[min(17rem,calc(100%-3rem))] overflow-hidden rounded-md border text-xs shadow-lg backdrop-blur sm:top-20"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-full justify-between rounded-none px-3 text-xs font-semibold"
              aria-label={t(
                `features.amendments.streetscape.actions.${legendOpen ? 'collapse' : 'expand'}`,
                {
                  label: t('features.amendments.streetscape.canvas.legend'),
                }
              )}
              title={t(
                `features.amendments.streetscape.actions.${legendOpen ? 'collapse' : 'expand'}`,
                {
                  label: t('features.amendments.streetscape.canvas.legend'),
                }
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Layers className="text-muted-foreground size-3.5 flex-none" />
                <span className="truncate">
                  {t('features.amendments.streetscape.canvas.legend')}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'size-3.5 flex-none transition-transform',
                  legendOpen ? 'rotate-180' : 'rotate-0'
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t">
            <div className="max-h-64 space-y-3 overflow-auto p-3 sm:max-h-80">
              {legendSections.map(section => (
                <section key={section.id} className="space-y-1.5">
                  <h3 className="text-muted-foreground text-[10px] font-semibold tracking-normal uppercase">
                    {t(section.labelKey)}
                  </h3>
                  {section.groups && section.groups.length > 0 ? (
                    <div className="space-y-2">
                      {section.groups.map(group => (
                        <div key={group.id} className="space-y-1">
                          <h4 className="text-muted-foreground/90 text-[10px] font-medium tracking-normal">
                            {t(group.labelKey)}
                          </h4>
                          {group.entries.map(entry => (
                            <StreetDesignLegendItem key={entry.id} entry={entry} />
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {section.entries.map(entry => (
                        <StreetDesignLegendItem key={entry.id} entry={entry} />
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
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
              {t(
                getStreetDesignObjectVariantLabelKey(selectedObject) ??
                  getStreetDesignObjectDefinition(selectedObject.type).labelKey
              )}
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

function StreetDesignLegendItem({ entry }: { entry: StreetDesignLegendEntry }) {
  const { t } = useTranslation();

  return (
    <div className="bg-background/75 flex min-h-10 items-center gap-2 rounded-md border px-2 py-1.5">
      <StreetDesignLegendPreview entry={entry} />
      <span className="min-w-0 truncate">{t(entry.labelKey)}</span>
    </div>
  );
}

function StreetDesignLegendPreview({ entry }: { entry: StreetDesignLegendEntry }) {
  const previewKind = getLegendPreviewKind(entry);

  return (
    <span
      className="bg-muted/30 relative h-8 w-10 flex-none overflow-hidden rounded-md border shadow-inner"
      data-testid={`street-design-legend-preview-${previewKind}`}
      data-legend-entry-id={entry.id}
      aria-hidden="true"
    >
      <span
        className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-black/15 blur-[1px]"
        aria-hidden="true"
      />
      {renderLegendPreviewContent(entry, previewKind)}
    </span>
  );
}

function getLegendPreviewKind(entry: StreetDesignLegendEntry) {
  if (entry.objectType) return entry.objectType;
  if (entry.layer) return entry.layer;
  return entry.renderKind;
}

function renderLegendPreviewContent(entry: StreetDesignLegendEntry, previewKind: string) {
  const color = entry.color;

  switch (previewKind as StreetDesignObjectType | string) {
    case 'tree': {
      const species = getLegendTreeSpecies(entry);
      if (species === 'conifer') {
        return (
          <>
            <span className="absolute bottom-2 left-[19px] h-3 w-1 rounded-sm bg-[#7a5635]" />
            <span
              className="absolute top-1 left-[12px] h-5 w-4 shadow-sm"
              style={{
                backgroundColor: color,
                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
              }}
            />
            <span
              className="absolute top-3 left-[10px] h-4 w-5"
              style={{
                backgroundColor: '#2f6f35',
                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
              }}
            />
          </>
        );
      }

      const canopyColor =
        species === 'ornamental_cherry'
          ? '#f4a7c4'
          : species === 'flowering_plum'
            ? '#b678a6'
            : color;

      return (
        <>
          <span className="absolute bottom-2 left-[18px] h-3 w-1 rounded-sm bg-[#7a5635]" />
          <span
            className={cn(
              'absolute shadow-sm',
              species === 'columnar_poplar'
                ? 'top-1 left-[15px] h-6 w-3 rounded-full'
                : 'top-1 left-[11px] size-4 rounded-full'
            )}
            style={{ backgroundColor: canopyColor }}
          />
          {species === 'columnar_poplar' ? null : (
            <span
              className="absolute top-2 left-[20px] size-3 rounded-full"
              style={{ backgroundColor: species === 'fruit' ? '#6a9b4f' : canopyColor }}
            />
          )}
          {species === 'fruit' ? (
            <>
              <span className="absolute top-2 left-[14px] size-1 rounded-full bg-[#dc2626]" />
              <span className="absolute top-4 left-[22px] size-1 rounded-full bg-[#facc15]" />
            </>
          ) : null}
        </>
      );
    }
    case 'bush':
    case 'hedge':
      return (
        <>
          <span
            className="absolute bottom-2 left-2 h-3 w-5 rounded-full shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute bottom-2 left-5 h-3 w-4 rounded-full bg-[#6a9b4f]" />
        </>
      );
    case 'street_lamp':
      return (
        <>
          <span className="absolute bottom-2 left-[19px] h-5 w-0.5 rounded-sm bg-[#475569]" />
          <span className="absolute top-1 left-[15px] size-3 rounded-full bg-[#fde68a] shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
          <span className="absolute bottom-1 left-[14px] h-1 w-3 rounded-full bg-[#64748b]" />
        </>
      );
    case 'bank':
      return (
        <>
          <span className="absolute top-3 left-2 h-1.5 w-6 rounded-sm bg-[#8a6a42]" />
          <span className="absolute top-5 left-2 h-1.5 w-6 rounded-sm bg-[#8a6a42]" />
          <span className="absolute top-4 left-3 h-3 w-0.5 bg-[#475569]" />
          <span className="absolute top-4 right-3 h-3 w-0.5 bg-[#475569]" />
        </>
      );
    case 'traffic_signal':
      return (
        <>
          <span className="absolute bottom-2 left-[12px] h-5 w-0.5 rounded-sm bg-[#475569]" />
          <span className="absolute top-1 left-[16px] flex h-5 w-2 flex-col items-center justify-center gap-0.5 rounded-sm bg-[#1f2937]">
            <span className="size-1 rounded-full bg-[#ef4444]" />
            <span className="size-1 rounded-full bg-[#f59e0b]" />
            <span className="size-1 rounded-full bg-[#22c55e]" />
          </span>
        </>
      );
    case 'bus_stop':
    case 'station_platform':
      return (
        <>
          <span className="absolute bottom-2 left-2 h-4 w-5 rounded-sm border border-[#2563eb] bg-[#dbeafe]" />
          <span className="absolute top-1 right-2 h-5 w-0.5 rounded-sm bg-[#475569]" />
          <span className="absolute top-1.5 right-[5px] size-2 rounded-full bg-[#2563eb]" />
        </>
      );
    case 'hydrant':
    case 'waste_bin':
    case 'recycling_container':
    case 'post_box':
    case 'fountain':
      return (
        <>
          <span
            className="absolute bottom-2 left-[14px] h-4 w-3 rounded-t-md shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute bottom-1 left-[12px] h-1 w-4 rounded-full bg-black/20" />
        </>
      );
    case 'building': {
      const buildingUse = getLegendStringProperty(entry, 'use', 'mixed');
      const isResidential = buildingUse === 'residential';
      const isIndustrial = buildingUse === 'industrial';
      const isOffice = buildingUse === 'office' || buildingUse === 'commercial';

      return (
        <>
          <span
            className={cn(
              'absolute right-2 bottom-2 rounded-[2px] shadow-sm',
              isOffice ? 'h-6 w-5' : 'h-5 w-5',
              isIndustrial ? 'bottom-2 h-4 w-6' : null
            )}
            style={{ backgroundColor: color }}
          />
          {isResidential ? (
            <span
              className="absolute right-1.5 bottom-[25px] h-2 w-6 bg-[#8a5f45]"
              style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}
            />
          ) : null}
          <span className="absolute right-3 bottom-4 grid grid-cols-2 gap-0.5">
            <span
              className={cn(
                'size-1 rounded-[1px]',
                isResidential ? 'bg-[#fde68a]' : 'bg-[#d7edf4]'
              )}
            />
            <span
              className={cn(
                'size-1 rounded-[1px]',
                isResidential ? 'bg-[#fde68a]' : 'bg-[#d7edf4]'
              )}
            />
            <span
              className={cn(
                'size-1 rounded-[1px]',
                isResidential ? 'bg-[#fef3c7]' : 'bg-[#d7edf4]'
              )}
            />
            <span
              className={cn(
                'size-1 rounded-[1px]',
                isResidential ? 'bg-[#fef3c7]' : 'bg-[#d7edf4]'
              )}
            />
          </span>
          {isIndustrial ? (
            <span className="absolute top-3 left-2 h-2 w-2 rounded-t-sm bg-[#475569]" />
          ) : (
            <span className="absolute right-1 bottom-[21px] h-1 w-5 skew-x-[-25deg] rounded-sm bg-white/35" />
          )}
        </>
      );
    }
    case 'street':
    case 'car_lane':
    case 'road': {
      const roadClass = getLegendStringProperty(entry, 'roadClass', 'residential');
      const status = getLegendStringProperty(entry, 'status', 'open');
      const isConstruction = roadClass === 'construction' || status === 'construction';
      const isPedestrian = roadClass === 'pedestrian' || roadClass === 'living_street';

      if (isConstruction) {
        return (
          <>
            <span
              className="absolute top-2 left-[-4px] h-4 w-12 -rotate-12 rounded-sm"
              style={{
                background: `repeating-linear-gradient(135deg, ${color}, ${color} 4px, #f8fafc 4px, #f8fafc 7px)`,
              }}
            />
          </>
        );
      }

      return (
        <>
          <span
            className={cn(
              'absolute left-[-4px] w-12 -rotate-12 rounded-sm',
              roadClass === 'primary' ? 'top-1.5 h-5' : 'top-2 h-4'
            )}
            style={{ backgroundColor: color }}
          />
          {isPedestrian ? (
            <>
              <span className="absolute inset-x-2 top-3 h-px -rotate-12 bg-white/45" />
              <span className="absolute inset-x-2 top-5 h-px -rotate-12 bg-white/45" />
              <span className="absolute top-2 left-5 h-4 w-px -rotate-12 bg-white/35" />
            </>
          ) : (
            <>
              <span className="absolute top-[15px] left-1 h-0.5 w-4 -rotate-12 rounded-full bg-[#f8fafc]" />
              <span className="absolute top-[12px] left-6 h-0.5 w-4 -rotate-12 rounded-full bg-[#f8fafc]" />
              {roadClass === 'primary' ? (
                <span className="absolute top-[18px] left-5 h-0.5 w-4 -rotate-12 rounded-full bg-[#f8fafc]" />
              ) : null}
            </>
          )}
        </>
      );
    }
    case 'bike_lane': {
      const protection = getLegendStringProperty(entry, 'protection', 'painted');

      return (
        <>
          <span
            className={cn(
              'absolute left-[-4px] w-12 -rotate-12 rounded-sm',
              protection === 'raised' ? 'top-1.5 h-5 border border-white/55' : 'top-2 h-4'
            )}
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-[13px] left-3 h-0.5 w-5 -rotate-12 rounded-full bg-[#c7fff5]" />
          <span className="absolute top-[17px] left-3 size-1 rounded-full bg-[#c7fff5]" />
          {protection === 'protected' ? (
            <>
              <span className="absolute top-[9px] left-3 size-1 rounded-full bg-white/80" />
              <span className="absolute top-[7px] left-6 size-1 rounded-full bg-white/80" />
            </>
          ) : null}
        </>
      );
    }
    case 'sidewalk':
    case 'stairs':
      return (
        <>
          <span
            className="absolute top-2 left-[-3px] h-4 w-12 -rotate-12 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute inset-x-2 top-3 h-px -rotate-12 bg-white/45" />
          <span className="absolute inset-x-2 top-5 h-px -rotate-12 bg-white/45" />
          <span className="absolute top-2 left-5 h-4 w-px -rotate-12 bg-white/35" />
        </>
      );
    case 'parking_area':
    case 'loading_zone':
    case 'parking':
      return (
        <>
          <span
            className="absolute top-2 left-1 h-5 w-8 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-3 h-3 w-px bg-white/70" />
          <span className="absolute top-3 left-6 h-3 w-px bg-white/70" />
        </>
      );
    case 'rail_track':
    case 'rail':
      return (
        <>
          <span className="absolute top-2 left-2 h-5 w-0.5 rotate-12 rounded-sm bg-[#475569]" />
          <span className="absolute top-2 right-2 h-5 w-0.5 rotate-12 rounded-sm bg-[#475569]" />
          <span className="absolute top-3 left-2 h-0.5 w-6 rotate-12 rounded-full bg-[#8a8178]" />
          <span className="absolute top-5 left-2 h-0.5 w-6 rotate-12 rounded-full bg-[#8a8178]" />
        </>
      );
    case 'water_area':
    case 'wetland_area':
    case 'water':
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-[45%] shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-4 left-3 h-0.5 w-5 rounded-full bg-white/55" />
          <span className="absolute top-5 left-5 h-0.5 w-3 rounded-full bg-white/45" />
        </>
      );
    case 'flower_bed':
    case 'grass_strip':
    case 'scrub_area':
    case 'heath_area':
    case 'orchard_area':
    case 'vineyard_area':
    case 'green':
    case 'trees':
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-[45%] shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-3 size-1 rounded-full bg-[#f9a8d4]" />
          <span className="absolute top-5 left-5 size-1 rounded-full bg-[#fde68a]" />
          <span className="absolute top-4 right-3 size-1 rounded-full bg-[#dcfce7]" />
        </>
      );
    case 'crossing':
      return (
        <>
          <span className="absolute top-2 left-[-4px] h-4 w-12 -rotate-12 rounded-sm bg-[#3f474c]" />
          <span className="absolute top-3 left-2 h-0.5 w-6 -rotate-12 bg-[#f8fafc]" />
          <span className="absolute top-[18px] left-2 h-0.5 w-6 -rotate-12 bg-[#f8fafc]" />
          <span className="absolute top-6 left-2 h-0.5 w-6 -rotate-12 bg-[#f8fafc]" />
        </>
      );
    case 'traffic_calming':
    case 'construction_area':
    case 'construction':
      return (
        <>
          <span
            className="absolute top-2 left-1 h-5 w-8 rounded-sm"
            style={{
              background: `repeating-linear-gradient(135deg, ${color}, ${color} 4px, #f8fafc 4px, #f8fafc 7px)`,
            }}
          />
        </>
      );
    case 'bollard':
    case 'gate':
    case 'fence':
    case 'wall':
    case 'barrier':
      return (
        <>
          <span className="absolute bottom-2 left-2 h-4 w-1 rounded-sm bg-[#475569]" />
          <span className="absolute bottom-2 left-[18px] h-4 w-1 rounded-sm bg-[#475569]" />
          <span className="absolute right-2 bottom-2 h-4 w-1 rounded-sm bg-[#475569]" />
          <span
            className="absolute top-4 left-2 h-1 w-7 rounded-sm"
            style={{ backgroundColor: color }}
          />
        </>
      );
    case 'playground':
    case 'sports_pitch':
    case 'sports':
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-3 h-3 w-5 rounded-sm border border-white/70" />
          <span className="absolute top-4 left-[18px] size-1 rounded-full bg-white/80" />
        </>
      );
    case 'landuse_context_area':
    case 'civic_area':
    case 'landuse_context':
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-3 h-3 w-3 rounded-sm bg-white/45" />
          <span className="absolute top-3 right-3 h-3 w-2 rounded-sm bg-white/30" />
        </>
      );
    default:
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-sm shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-2 h-0.5 w-6 rounded-full bg-white/35" />
        </>
      );
  }
}

function getLegendTreeSpecies(entry: StreetDesignLegendEntry) {
  const species = getLegendStringProperty(entry, 'species', 'deciduous').trim().toLowerCase();
  if (species === 'stadtbaum' || species === 'allee' || species === 'native') return 'deciduous';
  if (species === 'obstbaum') return 'fruit';
  if (species === 'zierkirsche' || species === 'japanese_cherry') return 'ornamental_cherry';
  if (species === 'pflaume' || species === 'plum') return 'flowering_plum';
  return species;
}

function getLegendStringProperty(entry: StreetDesignLegendEntry, key: string, fallback: string) {
  const value = entry.properties?.[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

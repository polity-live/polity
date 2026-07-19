import {
  Armchair,
  Bike,
  Building2,
  Calculator,
  CarFront,
  ChevronDown,
  Flower2,
  Footprints,
  GitCompareArrows,
  Layers,
  ParkingSquare,
  Route,
  Shrub,
  Sprout,
  Trash2,
  TreePine,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import type {
  StreetDesignComparisonMode,
  StreetDesignCostSummary,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
} from '../types';
import { ConvertedCurrencyAmount } from '@/features/shared/ui/currency';
import { minorToMajor } from '@/features/shared/logic/currency';

interface StreetCostSummaryViewProps {
  summary: StreetDesignCostSummary;
  comparisonMode: StreetDesignComparisonMode;
  selectedObjectId?: string | null;
  readOnly?: boolean;
  showComparisonControls?: boolean;
  variant?: 'section' | 'panel';
  onComparisonModeChange: (mode: StreetDesignComparisonMode) => void;
  onObjectSelect?: (objectId: string | null) => void;
  onDeleteObject?: (objectId: string) => void;
  onDeleteObjectCategory?: (category: StreetDesignObjectCategory) => void;
}

const comparisonModes: {
  mode: StreetDesignComparisonMode;
  labelKey: string;
}[] = [
  { mode: 'original', labelKey: 'features.amendments.streetscape.comparison.original' },
  { mode: 'new_design', labelKey: 'features.amendments.streetscape.comparison.newDesign' },
  { mode: 'overlay', labelKey: 'features.amendments.streetscape.comparison.overlay' },
  { mode: 'split', labelKey: 'features.amendments.streetscape.comparison.split' },
];

const objectIcons = {
  tree: TreePine,
  bush: Shrub,
  bank: Armchair,
  grass_strip: Sprout,
  flower_bed: Flower2,
  water_area: Waves,
  wetland_area: Waves,
  parking_area: ParkingSquare,
  loading_zone: ParkingSquare,
  street: Route,
  car_lane: CarFront,
  bike_lane: Bike,
  sidewalk: Footprints,
  building: Building2,
  street_lamp: Layers,
  hydrant: Waves,
  bicycle_parking: Bike,
  bollard: Layers,
  gate: Layers,
  fence: Layers,
  wall: Building2,
  traffic_signal: Layers,
  crossing: Footprints,
  traffic_calming: Layers,
  bus_stop: Route,
  rail_track: Route,
  playground: Sprout,
  sports_pitch: Sprout,
  waste_bin: Trash2,
  recycling_container: Sprout,
  post_box: Layers,
  fountain: Waves,
  stairs: Footprints,
  hedge: Shrub,
  scrub_area: Shrub,
  heath_area: Sprout,
  orchard_area: TreePine,
  vineyard_area: Layers,
  construction_area: Layers,
  landuse_context_area: Layers,
  civic_area: Building2,
  station_platform: Route,
  kerb: Layers,
  traffic_sign: Layers,
  traffic_island: Layers,
  public_space: Layers,
  building_entrance: Building2,
  charging_station: Layers,
  public_toilet: Armchair,
  taxi_stand: ParkingSquare,
} satisfies Record<StreetDesignObjectType, LucideIcon>;

const categoryIcons = {
  greenery: Sprout,
  mobility: Bike,
  street: Route,
  furniture: Armchair,
  building: Building2,
  water: Waves,
} satisfies Record<StreetDesignObjectCategory, LucideIcon>;

function StreetCurrencyAmount({
  amountMinor,
  currency,
}: {
  amountMinor: number;
  currency: string;
}) {
  return (
    <ConvertedCurrencyAmount amount={minorToMajor(amountMinor, currency)} currency={currency} />
  );
}

export function StreetCostSummaryView({
  summary,
  comparisonMode,
  selectedObjectId = null,
  readOnly = false,
  showComparisonControls = true,
  variant = 'section',
  onComparisonModeChange,
  onObjectSelect,
  onDeleteObject,
  onDeleteObjectCategory,
}: StreetCostSummaryViewProps) {
  const { t } = useTranslation();
  const [openCategories, setOpenCategories] = useState<StreetDesignObjectCategory[]>([]);
  const lineGroups = useMemo(() => {
    const groups = new Map<
      StreetDesignObjectCategory,
      {
        category: StreetDesignObjectCategory;
        lines: StreetDesignCostSummary['lines'];
        quantity: number;
        totalCostMinor: number;
      }
    >();

    summary.lines.forEach(line => {
      const group = groups.get(line.category) ?? {
        category: line.category,
        lines: [],
        quantity: 0,
        totalCostMinor: 0,
      };
      group.lines.push(line);
      group.quantity += line.quantity;
      group.totalCostMinor += line.totalCostMinor;
      groups.set(line.category, group);
    });

    return Array.from(groups.values());
  }, [summary.lines]);
  const setCategoryOpen = (category: StreetDesignObjectCategory, open: boolean) => {
    setOpenCategories(current =>
      open ? Array.from(new Set([...current, category])) : current.filter(item => item !== category)
    );
  };
  const getCategoryLabel = (category: StreetDesignObjectCategory) =>
    t(`features.amendments.streetscape.categories.${category}`);
  const getActionLabel = (action: 'collapse' | 'expand' | 'remove' | 'select', label: string) =>
    t(`features.amendments.streetscape.actions.${action}`, { label });

  return (
    <section className={cn('bg-background/95 border-t p-4', variant === 'panel' && 'shadow-none')}>
      <div
        className={cn(
          'grid gap-4',
          showComparisonControls
            ? 'xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]'
            : 'xl:grid-cols-1'
        )}
      >
        <div className="bg-card rounded-md border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calculator className="text-muted-foreground size-4" />
              <h2 className="text-sm font-semibold">
                {t('features.amendments.streetscape.cost.title')}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold">
                <StreetCurrencyAmount
                  amountMinor={summary.totalCostMinor}
                  currency={summary.currency}
                />
              </p>
              <p className="text-muted-foreground text-xs">
                {t('features.amendments.streetscape.cost.estimate')}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summary.categories.length === 0 ? (
              <div className="bg-muted/20 text-muted-foreground rounded-md border px-3 py-3 text-sm">
                {t('features.amendments.streetscape.cost.emptyCategories')}
              </div>
            ) : (
              summary.categories.map((category: StreetDesignCostSummary['categories'][number]) => (
                <div key={category.category} className="bg-muted/20 rounded-md border px-3 py-2">
                  <p className="text-xs font-medium">{getCategoryLabel(category.category)}</p>
                  <p className="text-sm font-semibold">
                    <StreetCurrencyAmount
                      amountMinor={category.totalCostMinor}
                      currency={summary.currency}
                    />
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {showComparisonControls ? (
          <div className="bg-card rounded-md border p-4">
            <div className="mb-3 flex items-center gap-2">
              <GitCompareArrows className="text-muted-foreground size-4" />
              <h2 className="text-sm font-semibold">
                {t('features.amendments.streetscape.cost.comparison')}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {comparisonModes.map(item => (
                <Button
                  key={item.mode}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-10 rounded-md px-2 text-xs',
                    comparisonMode === item.mode && 'border-brand/40 bg-brand/10 text-brand'
                  )}
                  onClick={() => onComparisonModeChange(item.mode)}
                >
                  {t(item.labelKey)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-muted/15 mt-4 rounded-md border p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="text-muted-foreground size-4" />
              {t('features.amendments.streetscape.cost.breakdown')}
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
              {t('features.amendments.streetscape.cost.breakdownDescription')}
            </p>
          </div>
          <span className="text-muted-foreground text-xs font-medium">{summary.lines.length}</span>
        </div>

        <div className="max-h-56 space-y-2 overflow-auto">
          {summary.lines.length === 0 ? (
            <div className="bg-background/80 text-muted-foreground rounded-md border px-3 py-3 text-sm">
              {t('features.amendments.streetscape.cost.emptyLines')}
            </div>
          ) : (
            lineGroups.map(group => {
              const CategoryIcon = categoryIcons[group.category];
              const categoryLabel = getCategoryLabel(group.category);
              const isCategoryOpen = openCategories.includes(group.category);
              const firstLine = group.lines[0] ?? null;

              return (
                <Collapsible
                  key={group.category}
                  open={isCategoryOpen}
                  onOpenChange={open => setCategoryOpen(group.category, open)}
                  className="space-y-2"
                >
                  <div
                    className={cn(
                      'bg-background/80 flex h-10 w-full items-center gap-2 rounded-md border px-3 text-xs',
                      group.lines.some(line => selectedObjectId === line.objectId) &&
                        'border-brand/40 bg-brand/10 text-brand'
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="-ml-1 size-7 flex-none"
                        aria-label={getActionLabel(
                          isCategoryOpen ? 'collapse' : 'expand',
                          categoryLabel
                        )}
                        title={getActionLabel(
                          isCategoryOpen ? 'collapse' : 'expand',
                          categoryLabel
                        )}
                      >
                        <ChevronDown
                          className={cn(
                            'size-4 transition-transform',
                            isCategoryOpen ? 'rotate-180' : 'rotate-0'
                          )}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <TooltipHint content={getActionLabel('select', categoryLabel)}>
                      <button
                        type="button"
                        aria-label={getActionLabel('select', categoryLabel)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                        onClick={() => onObjectSelect?.(firstLine?.objectId ?? null)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <CategoryIcon className="size-4 flex-none" />
                          <span className="truncate font-medium">{categoryLabel}</span>
                        </span>
                        <span className="text-muted-foreground flex flex-none items-center gap-2">
                          <span>{group.lines.length}</span>
                          <span className="text-foreground max-w-[8rem] truncate text-xs font-semibold">
                            <StreetCurrencyAmount
                              amountMinor={group.totalCostMinor}
                              currency={summary.currency}
                            />
                          </span>
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              group.lines.some(line => selectedObjectId === line.objectId)
                                ? 'bg-success'
                                : 'bg-muted-foreground/35'
                            )}
                          />
                        </span>
                      </button>
                    </TooltipHint>
                    <div className="-mr-1 flex flex-none items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive size-7"
                        title={getActionLabel('remove', categoryLabel)}
                        disabled={readOnly || !onDeleteObjectCategory}
                        onClick={() => onDeleteObjectCategory?.(group.category)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="space-y-1.5 pl-3">
                      {group.lines.map(line => {
                        const Icon = objectIcons[line.type];
                        const isSelected = selectedObjectId === line.objectId;
                        const lineLabel = t(line.displayLabelKey ?? line.labelKey);

                        return (
                          <div
                            key={line.objectId}
                            className={cn(
                              'bg-background/70 flex items-center gap-1.5 rounded-md border px-2 py-1.5',
                              isSelected && 'border-brand/40 bg-brand/10 text-brand'
                            )}
                          >
                            <TooltipHint content={getActionLabel('select', lineLabel)}>
                              <button
                                type="button"
                                aria-label={getActionLabel('select', lineLabel)}
                                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                                onClick={() => onObjectSelect?.(line.objectId)}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <Icon className="text-muted-foreground size-3.5 flex-none" />
                                  <span className="min-w-0 truncate">
                                    <span className="block truncate text-xs">{lineLabel}</span>
                                    <span className="text-muted-foreground block truncate text-[11px]">
                                      {line.quantity.toFixed(line.quantity % 1 ? 1 : 0)} x{' '}
                                      <StreetCurrencyAmount
                                        amountMinor={line.unitCostMinor}
                                        currency={summary.currency}
                                      />
                                    </span>
                                  </span>
                                </span>
                                <span className="flex flex-none items-center gap-2 text-right">
                                  <span className="max-w-[7rem] truncate text-xs font-semibold">
                                    <StreetCurrencyAmount
                                      amountMinor={line.totalCostMinor}
                                      currency={summary.currency}
                                    />
                                  </span>
                                  <span
                                    className={cn(
                                      'size-2 flex-none rounded-full',
                                      isSelected ? 'bg-success' : 'bg-muted-foreground/35'
                                    )}
                                  />
                                </span>
                              </button>
                            </TooltipHint>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-destructive size-6 flex-none"
                              title={getActionLabel('remove', lineLabel)}
                              disabled={readOnly || !onDeleteObject}
                              onClick={() => onDeleteObject?.(line.objectId)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

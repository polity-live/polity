import {
  Armchair,
  Bike,
  Building2,
  Camera,
  CarFront,
  ChevronDown,
  Eye,
  EyeOff,
  Flower2,
  Footprints,
  Highlighter,
  Layers,
  Plus,
  ParkingSquare,
  Route,
  Shrub,
  Sprout,
  TreePine,
  MousePointer2,
  Trash2,
  Waves,
} from 'lucide-react';
import { useMemo, useState, type ComponentType } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
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
  StreetDesignOsmLayerVisibility,
  StreetDesignPropertyValue,
} from '../types';
import { streetDesignObjectRegistry } from '../logic/streetDesignObjectRegistry';
import {
  streetDesignElementSections,
  type StreetDesignElementSection,
  type StreetDesignElementTool,
  type StreetDesignElementSectionIcon,
} from '../logic/streetDesignElementSections';
import { getStreetDesignObjectVariantLabelKey } from '../logic/streetDesignVariantCatalog';

interface StreetDesignToolbarViewProps {
  selectedTool: StreetDesignObjectType;
  selectedToolProperties: Record<string, StreetDesignPropertyValue>;
  interactionMode: StreetDesignInteractionMode;
  objects: StreetDesignObject[];
  selectedObjectId: string | null;
  hiddenObjectIds: string[];
  hiddenObjectCategories: StreetDesignObjectCategory[];
  osmLayerVisibility: StreetDesignOsmLayerVisibility;
  showStreetMarkings: boolean;
  readOnly: boolean;
  onToolChange: (
    type: StreetDesignObjectType,
    propertyOverrides?: Record<string, StreetDesignPropertyValue>,
    widthOverride?: number
  ) => void;
  onInteractionModeChange: (mode: StreetDesignInteractionMode) => void;
  onObjectSelect: (objectId: string | null) => void;
  onObjectVisibilityChange: (objectId: string, visible: boolean) => void;
  onObjectCategoryVisibilityChange: (
    category: StreetDesignObjectCategory,
    visible: boolean
  ) => void;
  onObjectDelete: (objectId: string) => void;
  onObjectCategoryDelete: (category: StreetDesignObjectCategory) => void;
  onOsmLayerVisibilityChange: (
    layer: keyof StreetDesignOsmLayerVisibility,
    visible: boolean
  ) => void;
  onShowStreetMarkingsChange: (visible: boolean) => void;
}

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
  street_lamp: Highlighter,
  hydrant: Waves,
  bicycle_parking: Bike,
  bollard: Layers,
  gate: Layers,
  fence: Layers,
  wall: Building2,
  traffic_signal: Highlighter,
  crossing: Footprints,
  traffic_calming: Highlighter,
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
  construction_area: Highlighter,
  landuse_context_area: Layers,
  civic_area: Building2,
  station_platform: Route,
  kerb: Layers,
  traffic_sign: Highlighter,
  traffic_island: Highlighter,
  public_space: Layers,
  building_entrance: Building2,
  charging_station: Highlighter,
  public_toilet: Armchair,
  taxi_stand: ParkingSquare,
} satisfies Record<StreetDesignObjectType, ComponentType<{ className?: string }>>;

const categoryIcons = {
  greenery: Sprout,
  mobility: Bike,
  street: Route,
  furniture: Armchair,
  building: Building2,
  water: Waves,
} satisfies Record<StreetDesignObjectCategory, ComponentType<{ className?: string }>>;

const sectionIcons = {
  Armchair,
  Bike,
  Building2,
  Footprints,
  Highlighter,
  Layers,
  ParkingSquare,
  Route,
  Shrub,
  Sprout,
  TreePine,
  Waves,
} satisfies Record<StreetDesignElementSectionIcon, ComponentType<{ className?: string }>>;

function getSectionTools(section: StreetDesignElementSection): StreetDesignElementTool[] {
  return (
    section.tools ??
    section.objectTypes.map(type => ({
      id: type,
      objectType: type,
    }))
  );
}

function isSectionToolSelected(args: {
  tool: StreetDesignElementTool;
  selectedTool: StreetDesignObjectType;
  selectedToolProperties: Record<string, StreetDesignPropertyValue>;
}) {
  if (args.selectedTool !== args.tool.objectType) return false;

  const selectionPropertyKeys = args.tool.selectionPropertyKeys ?? [];
  if (selectionPropertyKeys.length === 0) return !args.tool.propertyOverrides;

  return selectionPropertyKeys.every(
    key => args.selectedToolProperties[key] === args.tool.propertyOverrides?.[key]
  );
}

export function StreetDesignToolbarView({
  selectedTool,
  selectedToolProperties,
  interactionMode,
  objects,
  selectedObjectId,
  hiddenObjectIds,
  hiddenObjectCategories,
  osmLayerVisibility,
  showStreetMarkings,
  readOnly,
  onToolChange,
  onInteractionModeChange,
  onObjectSelect,
  onObjectVisibilityChange,
  onObjectCategoryVisibilityChange,
  onObjectDelete,
  onObjectCategoryDelete,
  onOsmLayerVisibilityChange,
  onShowStreetMarkingsChange,
}: StreetDesignToolbarViewProps) {
  const { t } = useTranslation();
  const [isExistingOpen, setIsExistingOpen] = useState(true);
  const [isElementsOpen, setIsElementsOpen] = useState(true);
  const [isAddedOpen, setIsAddedOpen] = useState(true);
  const [openAddedCategories, setOpenAddedCategories] = useState<StreetDesignObjectCategory[]>([]);
  const hiddenObjectIdSet = useMemo(() => new Set(hiddenObjectIds), [hiddenObjectIds]);
  const hiddenCategorySet = useMemo(
    () => new Set(hiddenObjectCategories),
    [hiddenObjectCategories]
  );
  const addedObjectGroups = useMemo(() => {
    const groups = new Map<
      StreetDesignObjectCategory,
      {
        category: StreetDesignObjectCategory;
        objects: StreetDesignObject[];
      }
    >();

    objects.forEach(object => {
      const category = streetDesignObjectRegistry[object.type].category;
      const group = groups.get(category) ?? { category, objects: [] };
      group.objects.push(object);
      groups.set(category, group);
    });

    return Array.from(groups.values());
  }, [objects]);
  const setAddedCategoryOpen = (category: StreetDesignObjectCategory, open: boolean) => {
    setOpenAddedCategories(current =>
      open ? Array.from(new Set([...current, category])) : current.filter(item => item !== category)
    );
  };
  const getCategoryLabel = (category: StreetDesignObjectCategory) =>
    t(`features.amendments.streetscape.categories.${category}`);
  const getActionLabel = (
    action: 'collapse' | 'expand' | 'hide' | 'show' | 'remove' | 'select',
    label: string
  ) => t(`features.amendments.streetscape.actions.${action}`, { label });

  return (
    <aside className="bg-background/95 flex h-full min-w-0 flex-col gap-5 border-b p-4 shadow-sm xl:border-r xl:border-b-0">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Camera className="text-muted-foreground size-4" />
          {t('features.amendments.streetscape.toolbar.mode')}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'h-14 flex-col gap-1 rounded-md px-2 text-xs',
              interactionMode === 'place' && 'border-brand/40 bg-brand/10 text-brand'
            )}
            disabled={readOnly}
            onClick={() => onInteractionModeChange('place')}
          >
            <Plus className="size-4" />
            {t('features.amendments.streetscape.modes.place')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'h-14 flex-col gap-1 rounded-md px-2 text-xs',
              interactionMode === 'select' && 'border-brand/40 bg-brand/10 text-brand'
            )}
            onClick={() => onInteractionModeChange('select')}
          >
            <MousePointer2 className="size-4" />
            {t('features.amendments.streetscape.modes.select')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'h-14 flex-col gap-1 rounded-md px-2 text-xs',
              interactionMode === 'camera' && 'border-brand/40 bg-brand/10 text-brand'
            )}
            onClick={() => onInteractionModeChange('camera')}
          >
            <Camera className="size-4" />
            {t('features.amendments.streetscape.modes.camera')}
          </Button>
        </div>
      </div>

      <Collapsible
        open={isExistingOpen}
        onOpenChange={setIsExistingOpen}
        className="bg-muted/15 rounded-md border p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="text-muted-foreground size-4" />
              {t('features.amendments.streetscape.toolbar.existing.title')}
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
              {t('features.amendments.streetscape.toolbar.existing.description')}
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 flex-none"
              aria-label={getActionLabel(
                isExistingOpen ? 'collapse' : 'expand',
                t('features.amendments.streetscape.toolbar.existing.title')
              )}
              title={getActionLabel(
                isExistingOpen ? 'collapse' : 'expand',
                t('features.amendments.streetscape.toolbar.existing.title')
              )}
            >
              <ChevronDown
                className={cn(
                  'size-4 transition-transform',
                  isExistingOpen ? 'rotate-180' : 'rotate-0'
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="mt-3 space-y-2">
            {streetDesignElementSections.map(section => {
              const Icon = sectionIcons[section.icon];
              const isVisible = osmLayerVisibility[section.layer];
              const layerLabel = t(section.labelKey);

              return (
                <Button
                  key={section.layer}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'bg-background/80 h-10 w-full justify-between gap-2 rounded-md px-3 text-xs',
                    isVisible && 'border-brand/40 bg-brand/10 text-brand'
                  )}
                  title={getActionLabel(isVisible ? 'hide' : 'show', layerLabel)}
                  onClick={() => onOsmLayerVisibilityChange(section.layer, !isVisible)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 flex-none" />
                    <span className="truncate">{layerLabel}</span>
                  </span>
                  <span
                    className={cn(
                      'size-2 flex-none rounded-full',
                      isVisible ? 'bg-success' : 'bg-muted-foreground/35'
                    )}
                  />
                </Button>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'bg-background/80 h-10 w-full justify-between gap-2 rounded-md px-3 text-xs',
                showStreetMarkings && 'border-brand/40 bg-brand/10 text-brand'
              )}
              title={getActionLabel(
                showStreetMarkings ? 'hide' : 'show',
                t('features.amendments.streetscape.osmLayers.streetMarkings')
              )}
              onClick={() => onShowStreetMarkingsChange(!showStreetMarkings)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Highlighter className="size-4 flex-none" />
                <span className="truncate">
                  {t('features.amendments.streetscape.osmLayers.streetMarkings')}
                </span>
              </span>
              <span
                className={cn(
                  'size-2 flex-none rounded-full',
                  showStreetMarkings ? 'bg-success' : 'bg-muted-foreground/35'
                )}
              />
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        open={isElementsOpen}
        onOpenChange={setIsElementsOpen}
        className="bg-muted/15 rounded-md border p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="text-muted-foreground size-4" />
              {t('features.amendments.streetscape.toolbar.elements.title')}
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
              {t('features.amendments.streetscape.toolbar.elements.description')}
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 flex-none"
              aria-label={getActionLabel(
                isElementsOpen ? 'collapse' : 'expand',
                t('features.amendments.streetscape.toolbar.elements.title')
              )}
              title={getActionLabel(
                isElementsOpen ? 'collapse' : 'expand',
                t('features.amendments.streetscape.toolbar.elements.title')
              )}
            >
              <ChevronDown
                className={cn(
                  'size-4 transition-transform',
                  isElementsOpen ? 'rotate-180' : 'rotate-0'
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="mt-3 space-y-4">
            {streetDesignElementSections.map(section => {
              const SectionIcon = sectionIcons[section.icon];
              const sectionLabel = t(section.labelKey);

              return (
                <section key={section.layer} className="space-y-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-normal uppercase">
                    <SectionIcon className="size-3.5 flex-none" />
                    <span className="truncate">{sectionLabel}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {getSectionTools(section).map(tool => {
                      const type = tool.objectType;
                      const definition = streetDesignObjectRegistry[type];
                      const Icon = objectIcons[type];
                      const isSelected = isSectionToolSelected({
                        tool,
                        selectedTool,
                        selectedToolProperties,
                      });
                      const objectLabel = t(tool.labelKey ?? definition.labelKey);

                      return (
                        <Button
                          key={tool.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            'bg-background/80 h-16 flex-col gap-1 rounded-md px-2 text-[11px] leading-tight',
                            isSelected && 'border-brand/40 bg-brand/10 text-brand'
                          )}
                          disabled={readOnly}
                          title={objectLabel}
                          onClick={() => {
                            if (tool.propertyOverrides || typeof tool.widthOverride === 'number') {
                              onToolChange(type, tool.propertyOverrides, tool.widthOverride);
                              return;
                            }

                            onToolChange(type);
                          }}
                        >
                          <Icon className="size-4" />
                          <span className="max-w-full truncate">{objectLabel}</span>
                        </Button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        open={isAddedOpen}
        onOpenChange={setIsAddedOpen}
        className="bg-muted/15 rounded-md border p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="text-muted-foreground size-4" />
              {t('features.amendments.streetscape.toolbar.added.title')}
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
              {t('features.amendments.streetscape.toolbar.added.description')}
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 flex-none"
              aria-label={getActionLabel(
                isAddedOpen ? 'collapse' : 'expand',
                t('features.amendments.streetscape.toolbar.added.title')
              )}
              title={getActionLabel(
                isAddedOpen ? 'collapse' : 'expand',
                t('features.amendments.streetscape.toolbar.added.title')
              )}
            >
              <ChevronDown
                className={cn(
                  'size-4 transition-transform',
                  isAddedOpen ? 'rotate-180' : 'rotate-0'
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="mt-3 space-y-3">
            {addedObjectGroups.length === 0 ? (
              <div className="bg-background/80 text-muted-foreground rounded-md border px-3 py-3 text-xs">
                {t('features.amendments.streetscape.toolbar.added.empty')}
              </div>
            ) : (
              addedObjectGroups.map(group => {
                const CategoryIcon = categoryIcons[group.category];
                const categoryLabel = getCategoryLabel(group.category);
                const isCategoryHidden = hiddenCategorySet.has(group.category);
                const isCategoryOpen = openAddedCategories.includes(group.category);
                const firstObject = group.objects[0] ?? null;

                return (
                  <Collapsible
                    key={group.category}
                    open={isCategoryOpen}
                    onOpenChange={open => setAddedCategoryOpen(group.category, open)}
                    className="space-y-2"
                  >
                    <div
                      className={cn(
                        'bg-background/80 flex h-10 w-full items-center gap-2 rounded-md border px-3 text-xs',
                        selectedObjectId === firstObject?.id &&
                          'border-brand/40 bg-brand/10 text-brand',
                        isCategoryHidden && 'text-muted-foreground opacity-75'
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
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                        title={getActionLabel('select', categoryLabel)}
                        onClick={() => onObjectSelect(firstObject?.id ?? null)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <CategoryIcon className="size-4 flex-none" />
                          <span className="truncate font-medium">{categoryLabel}</span>
                        </span>
                        <span className="text-muted-foreground flex flex-none items-center gap-2">
                          <span>{group.objects.length}</span>
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              isCategoryHidden ? 'bg-muted-foreground/35' : 'bg-success'
                            )}
                          />
                        </span>
                      </button>
                      <div className="-mr-1 flex flex-none items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title={getActionLabel(isCategoryHidden ? 'show' : 'hide', categoryLabel)}
                          onClick={() =>
                            onObjectCategoryVisibilityChange(group.category, isCategoryHidden)
                          }
                        >
                          {isCategoryHidden ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive size-7"
                          title={getActionLabel('remove', categoryLabel)}
                          disabled={readOnly}
                          onClick={() => onObjectCategoryDelete(group.category)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="space-y-1.5 pl-3">
                        {group.objects.map(object => {
                          const definition = streetDesignObjectRegistry[object.type];
                          const Icon = objectIcons[object.type];
                          const isObjectHidden = hiddenObjectIdSet.has(object.id);
                          const isEffectivelyVisible = !isCategoryHidden && !isObjectHidden;
                          const isSelected = selectedObjectId === object.id;
                          const objectLabel = t(
                            getStreetDesignObjectVariantLabelKey(object) ?? definition.labelKey
                          );

                          return (
                            <div
                              key={object.id}
                              className={cn(
                                'bg-background/70 flex items-center gap-1.5 rounded-md border px-2 py-1.5',
                                isSelected && 'border-brand/40 bg-brand/10 text-brand',
                                !isEffectivelyVisible && 'text-muted-foreground opacity-70'
                              )}
                            >
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                                title={getActionLabel('select', objectLabel)}
                                onClick={() => onObjectSelect(object.id)}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <Icon className="text-muted-foreground size-3.5 flex-none" />
                                  <span className="truncate text-xs">{objectLabel}</span>
                                </span>
                                <span
                                  className={cn(
                                    'size-2 flex-none rounded-full',
                                    isEffectivelyVisible ? 'bg-success' : 'bg-muted-foreground/35'
                                  )}
                                />
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 flex-none"
                                title={getActionLabel(
                                  isObjectHidden ? 'show' : 'hide',
                                  objectLabel
                                )}
                                onClick={() => onObjectVisibilityChange(object.id, isObjectHidden)}
                              >
                                {isObjectHidden ? (
                                  <EyeOff className="size-3" />
                                ) : (
                                  <Eye className="size-3" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive size-6 flex-none"
                                title={getActionLabel('remove', objectLabel)}
                                disabled={readOnly}
                                onClick={() => onObjectDelete(object.id)}
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
        </CollapsibleContent>
      </Collapsible>
    </aside>
  );
}

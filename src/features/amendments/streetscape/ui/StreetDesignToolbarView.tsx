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
import { cn } from '@/features/shared/utils/utils';
import type {
  StreetDesignInteractionMode,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
} from '../types';
import {
  streetDesignObjectRegistry,
  streetDesignObjectTypes,
} from '../logic/streetDesignObjectRegistry';

interface StreetDesignToolbarViewProps {
  selectedTool: StreetDesignObjectType;
  interactionMode: StreetDesignInteractionMode;
  objects: StreetDesignObject[];
  selectedObjectId: string | null;
  hiddenObjectIds: string[];
  hiddenObjectCategories: StreetDesignObjectCategory[];
  osmLayerVisibility: StreetDesignOsmLayerVisibility;
  showStreetMarkings: boolean;
  readOnly: boolean;
  onToolChange: (type: StreetDesignObjectType) => void;
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
  parking_area: ParkingSquare,
  street: Route,
  car_lane: CarFront,
  bike_lane: Bike,
  sidewalk: Footprints,
  building: Building2,
} satisfies Record<StreetDesignObjectType, ComponentType<{ className?: string }>>;

const categoryLabels = {
  greenery: 'Gruen',
  mobility: 'Mobilitaet',
  street: 'Strasse',
  furniture: 'Moeblierung',
  building: 'Gebaeude',
  water: 'Wasser',
} satisfies Record<StreetDesignObjectCategory, string>;

const categoryIcons = {
  greenery: Sprout,
  mobility: Bike,
  street: Route,
  furniture: Armchair,
  building: Building2,
  water: Waves,
} satisfies Record<StreetDesignObjectCategory, ComponentType<{ className?: string }>>;

export function StreetDesignToolbarView({
  selectedTool,
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
  const [isExistingOpen, setIsExistingOpen] = useState(true);
  const [isElementsOpen, setIsElementsOpen] = useState(true);
  const [isAddedOpen, setIsAddedOpen] = useState(true);
  const [openAddedCategories, setOpenAddedCategories] = useState<StreetDesignObjectCategory[]>([]);
  const layerToggles = [
    { layer: 'building', label: 'Gebaeude', icon: Building2 },
    { layer: 'road', label: 'Strassen', icon: Route },
    { layer: 'green', label: 'Gruen', icon: Sprout },
    { layer: 'water', label: 'Wasser', icon: Waves },
  ] satisfies {
    layer: keyof StreetDesignOsmLayerVisibility;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }[];
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

  return (
    <aside className="bg-background/95 flex h-full min-w-0 flex-col gap-5 border-b p-4 shadow-sm xl:border-r xl:border-b-0">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Camera className="text-muted-foreground size-4" />
          Modus
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
            Platzieren
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
            Selektieren
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
            Kamera
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
              OSM Bestand
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
              Kartendaten und Markierungen
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 flex-none"
              aria-label={isExistingOpen ? 'OSM Bestand einklappen' : 'OSM Bestand ausklappen'}
              title={isExistingOpen ? 'OSM Bestand einklappen' : 'OSM Bestand ausklappen'}
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
            {layerToggles.map(item => {
              const Icon = item.icon;
              const isVisible = osmLayerVisibility[item.layer];

              return (
                <Button
                  key={item.layer}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'bg-background/80 h-10 w-full justify-between gap-2 rounded-md px-3 text-xs',
                    isVisible && 'border-brand/40 bg-brand/10 text-brand'
                  )}
                  title={`${item.label} ${isVisible ? 'ausblenden' : 'einblenden'}`}
                  onClick={() => onOsmLayerVisibilityChange(item.layer, !isVisible)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 flex-none" />
                    <span className="truncate">{item.label}</span>
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
              title={showStreetMarkings ? 'Markierungen ausblenden' : 'Markierungen einblenden'}
              onClick={() => onShowStreetMarkingsChange(!showStreetMarkings)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Highlighter className="size-4 flex-none" />
                <span className="truncate">Markierungen</span>
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
              Neue Elemente
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
              Werkzeug auswaehlen und platzieren
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 flex-none"
              aria-label={isElementsOpen ? 'Neue Elemente einklappen' : 'Neue Elemente ausklappen'}
              title={isElementsOpen ? 'Neue Elemente einklappen' : 'Neue Elemente ausklappen'}
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            {streetDesignObjectTypes.map((type: StreetDesignObjectType) => {
              const definition = streetDesignObjectRegistry[type];
              const Icon = objectIcons[type];
              const isSelected = selectedTool === type;

              return (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'bg-background/80 h-16 flex-col gap-1 rounded-md px-2 text-[11px] leading-tight',
                    isSelected && 'border-brand/40 bg-brand/10 text-brand'
                  )}
                  disabled={readOnly}
                  title={definition.label}
                  onClick={() => onToolChange(type)}
                >
                  <Icon className="size-4" />
                  <span className="max-w-full truncate">{definition.label}</span>
                </Button>
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
              Hinzugefügt
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
              Gruppen und Elemente verwalten
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 flex-none"
              aria-label={isAddedOpen ? 'Hinzugefügt einklappen' : 'Hinzugefügt ausklappen'}
              title={isAddedOpen ? 'Hinzugefügt einklappen' : 'Hinzugefügt ausklappen'}
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
                Noch keine Elemente.
              </div>
            ) : (
              addedObjectGroups.map(group => {
                const CategoryIcon = categoryIcons[group.category];
                const categoryLabel = categoryLabels[group.category];
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
                          aria-label={
                            isCategoryOpen
                              ? `${categoryLabel} einklappen`
                              : `${categoryLabel} ausklappen`
                          }
                          title={
                            isCategoryOpen
                              ? `${categoryLabel} einklappen`
                              : `${categoryLabel} ausklappen`
                          }
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
                        title={`${categoryLabel} auswählen`}
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
                          title={`${categoryLabel} ${
                            isCategoryHidden ? 'einblenden' : 'ausblenden'
                          }`}
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
                          title={`${categoryLabel} entfernen`}
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
                                title={`${definition.label} auswählen`}
                                onClick={() => onObjectSelect(object.id)}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <Icon className="text-muted-foreground size-3.5 flex-none" />
                                  <span className="truncate text-xs">{definition.label}</span>
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
                                title={`${definition.label} ${
                                  isObjectHidden ? 'einblenden' : 'ausblenden'
                                }`}
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
                                title={`${definition.label} entfernen`}
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

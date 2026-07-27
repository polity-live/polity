import {
  Armchair,
  Bike,
  Building2,
  Calculator,
  Camera,
  CarFront,
  Eye,
  EyeOff,
  Flower2,
  Footprints,
  GitCompareArrows,
  Highlighter,
  Layers,
  MapPinned,
  MessageSquare,
  MousePointer2,
  Palette,
  ParkingSquare,
  PanelRight,
  Plus,
  Route,
  Save,
  Shrub,
  Sprout,
  Trash2,
  TreePine,
  Users,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';

import { InviteCollaboratorDialog } from '@/features/editor/ui/InviteCollaboratorDialog';
import { FixedToolbar } from '@/features/shared/ui/ui-platejs/fixed-toolbar';
import { ToolbarButton, ToolbarGroup } from '@/features/shared/ui/layout';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton';
import {
  EditingModeMenuItems,
  getEditingModeOption,
  type SelectableEditingMode,
} from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/features/shared/ui/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { isAppTutorialActiveInDocument } from '@/features/app-tutorial/events';

import type {
  CityDesignComparisonMode,
  CityDesignCostSummary,
  CityDesignInteractionMode,
  CityDesignObject,
  CityDesignObjectCategory,
  CityDesignObjectType,
  CityDesignOsmLayerVisibility,
  CityDesignOsmWay,
  CityDesignPropertyValue,
} from '../types';
import {
  cityDesignElementSections,
  type CityDesignElementSection,
  type CityDesignElementSectionIcon,
  type CityDesignElementTool,
} from '../logic/cityDesignElementSections';
import { formatMinorCurrency } from '../logic/cityDesignCostCatalog';
import { cityDesignObjectRegistry } from '../logic/cityDesignObjectRegistry';
import { getCityDesignObjectVariantLabelKey } from '../logic/cityDesignVariantCatalog';
import type {
  CityDesignChangeRequest,
  CityDesignChangeRequestColorMode,
} from '../logic/cityDesignChangeRequests';
import {
  formatCityDesignChangeRequestIdentifier,
  formatCityDesignChangeRequestTitle,
  getCityDesignChangeRequestTone,
} from '../logic/cityDesignChangeRequests';

interface CityDesignTopBarViewProps {
  positionMode?: 'viewport' | 'container';
  availableModes?: readonly SelectableEditingMode[];
  readOnly: boolean;
  mapContextReadOnly: boolean;
  mode: SelectableEditingMode;
  modeDisabledReasons: Partial<Record<SelectableEditingMode, string>>;
  canChangeMode: boolean;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  selectedTool: CityDesignObjectType;
  selectedToolProperties: Record<string, CityDesignPropertyValue>;
  interactionMode: CityDesignInteractionMode;
  objects: CityDesignObject[];
  selectedObjectId: string | null;
  selectedOsmWay: CityDesignOsmWay | null;
  hiddenObjectIds: string[];
  hiddenObjectCategories: CityDesignObjectCategory[];
  osmLayerVisibility: CityDesignOsmLayerVisibility;
  showStreetMarkings: boolean;
  comparisonMode: CityDesignComparisonMode;
  costSummary: CityDesignCostSummary;
  areaPickerOpen: boolean;
  costSummaryOpen: boolean;
  isLoadingOsm: boolean;
  osmError: string | null;
  areaPickerContent: ReactNode;
  costSummaryContent: ReactNode;
  onModeChange: (mode: SelectableEditingMode) => void | Promise<void>;
  onSave: () => void;
  onToolChange: (
    type: CityDesignObjectType,
    propertyOverrides?: Record<string, CityDesignPropertyValue>,
    widthOverride?: number
  ) => void;
  onInteractionModeChange: (mode: CityDesignInteractionMode) => void;
  onObjectSelect: (objectId: string | null) => void;
  onObjectVisibilityChange: (objectId: string, visible: boolean) => void;
  onObjectCategoryVisibilityChange: (category: CityDesignObjectCategory, visible: boolean) => void;
  onObjectDelete: (objectId: string) => void;
  onObjectCategoryDelete: (category: CityDesignObjectCategory) => void;
  onOsmLayerVisibilityChange: (layer: keyof CityDesignOsmLayerVisibility, visible: boolean) => void;
  onShowStreetMarkingsChange: (visible: boolean) => void;
  onComparisonModeChange: (mode: CityDesignComparisonMode) => void;
  onAreaPickerOpenChange: (open: boolean) => void;
  onCostSummaryOpenChange: (open: boolean) => void;
  onLoadOsm: () => void;
  onOsmWayHide: (osmWayId: string) => void;
}

interface CityDesignSecondaryActionBarViewProps {
  amendmentId: string;
  title: string;
  readOnly: boolean;
  currentUserId?: string;
  collaborationDocumentId?: string | null;
  existingCollaboratorIds: string[];
  changeRequests: readonly CityDesignChangeRequest[];
  selectedChangeRequestId: string | null;
  showChangeRequests: boolean;
  changeRequestColorMode?: CityDesignChangeRequestColorMode;
  onShowChangeRequestsChange: (visible: boolean) => void;
  onChangeRequestColorModeChange?: (mode: CityDesignChangeRequestColorMode) => void;
  onChangeRequestSelect: (changeRequestId: string | null) => void;
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
} satisfies Record<CityDesignObjectType, LucideIcon>;

const categoryIcons = {
  greenery: Sprout,
  mobility: Bike,
  street: Route,
  furniture: Armchair,
  building: Building2,
  water: Waves,
} satisfies Record<CityDesignObjectCategory, ComponentType<{ className?: string }>>;

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
} satisfies Record<CityDesignElementSectionIcon, ComponentType<{ className?: string }>>;

const comparisonModes: { mode: CityDesignComparisonMode; labelKey: string }[] = [
  { mode: 'original', labelKey: 'features.amendments.cityDesign.comparison.original' },
  { mode: 'new_design', labelKey: 'features.amendments.cityDesign.comparison.newDesign' },
  { mode: 'overlay', labelKey: 'features.amendments.cityDesign.comparison.overlay' },
  { mode: 'split', labelKey: 'features.amendments.cityDesign.comparison.split' },
];

function getSectionTools(section: CityDesignElementSection): CityDesignElementTool[] {
  return (
    section.tools ??
    section.objectTypes.map(type => ({
      id: type,
      objectType: type,
    }))
  );
}

function isSectionToolSelected(args: {
  tool: CityDesignElementTool;
  selectedTool: CityDesignObjectType;
  selectedToolProperties: Record<string, CityDesignPropertyValue>;
}) {
  if (args.selectedTool !== args.tool.objectType) return false;

  const selectionPropertyKeys = args.tool.selectionPropertyKeys ?? [];
  if (selectionPropertyKeys.length === 0) return !args.tool.propertyOverrides;

  return selectionPropertyKeys.every(
    key => args.selectedToolProperties[key] === args.tool.propertyOverrides?.[key]
  );
}

export function CityDesignTopBarView({
  positionMode = 'viewport',
  availableModes,
  readOnly,
  mapContextReadOnly,
  mode,
  modeDisabledReasons,
  canChangeMode,
  isDirty,
  isSaving,
  saveError,
  selectedTool,
  selectedToolProperties,
  interactionMode,
  objects,
  selectedObjectId,
  selectedOsmWay,
  hiddenObjectIds,
  hiddenObjectCategories,
  osmLayerVisibility,
  showStreetMarkings,
  comparisonMode,
  costSummary,
  areaPickerOpen,
  costSummaryOpen,
  isLoadingOsm,
  osmError,
  areaPickerContent,
  costSummaryContent,
  onModeChange,
  onSave,
  onToolChange,
  onInteractionModeChange,
  onObjectSelect,
  onObjectVisibilityChange,
  onObjectCategoryVisibilityChange,
  onObjectDelete,
  onObjectCategoryDelete,
  onOsmLayerVisibilityChange,
  onShowStreetMarkingsChange,
  onComparisonModeChange,
  onAreaPickerOpenChange,
  onCostSummaryOpenChange,
  onLoadOsm,
  onOsmWayHide,
}: CityDesignTopBarViewProps) {
  const { t } = useTranslation();
  const tutorialActive = isAppTutorialActiveInDocument();
  const hiddenObjectIdSet = useMemo(() => new Set(hiddenObjectIds), [hiddenObjectIds]);
  const hiddenCategorySet = useMemo(
    () => new Set(hiddenObjectCategories),
    [hiddenObjectCategories]
  );
  const objectGroups = useMemo(() => {
    const groups = new Map<
      CityDesignObjectCategory,
      {
        category: CityDesignObjectCategory;
        objects: CityDesignObject[];
      }
    >();

    objects.forEach(object => {
      const category = cityDesignObjectRegistry[object.type].category;
      const group = groups.get(category) ?? { category, objects: [] };
      group.objects.push(object);
      groups.set(category, group);
    });

    return Array.from(groups.values());
  }, [objects]);

  const selectedObject = selectedObjectId
    ? (objects.find(object => object.id === selectedObjectId) ?? null)
    : null;
  const selectedObjectLabel = selectedObject
    ? t(
        getCityDesignObjectVariantLabelKey(selectedObject) ??
          cityDesignObjectRegistry[selectedObject.type].labelKey
      )
    : null;

  const getCategoryLabel = (category: CityDesignObjectCategory) =>
    t(`features.amendments.cityDesign.categories.${category}`);
  const getActionLabel = (action: 'hide' | 'remove' | 'select' | 'show', label: string) =>
    t(`features.amendments.cityDesign.actions.${action}`, { label });

  return (
    <FixedToolbar
      positionMode={positionMode}
      data-tutorial-horizontal-scroller="city-design-toolbar"
      className="gap-0 rounded-none border-x-0 border-t-0 px-1 py-1 shadow-none"
    >
      <ToolbarGroup>
        {!readOnly ? (
          <ToolbarButton
            type="button"
            aria-label={t('features.amendments.cityDesign.modes.place')}
            pressed={interactionMode === 'place'}
            tooltip={t('features.amendments.cityDesign.modes.place')}
            onClick={() => onInteractionModeChange('place')}
          >
            <Plus className="size-4" />
          </ToolbarButton>
        ) : null}
        <ToolbarButton
          type="button"
          aria-label={t('features.amendments.cityDesign.modes.select')}
          pressed={interactionMode === 'select'}
          tooltip={t('features.amendments.cityDesign.modes.select')}
          onClick={() => onInteractionModeChange('select')}
        >
          <MousePointer2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          type="button"
          aria-label={t('features.amendments.cityDesign.modes.camera')}
          pressed={interactionMode === 'camera'}
          tooltip={t('features.amendments.cityDesign.modes.camera')}
          onClick={() => onInteractionModeChange('camera')}
        >
          <Camera className="size-4" />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <CityDesignModeToolbarButton
          availableModes={availableModes}
          canChangeMode={canChangeMode}
          disabledModeReasons={modeDisabledReasons}
          mode={mode}
          onModeChange={onModeChange}
        />
      </ToolbarGroup>

      <ToolbarGroup>
        <Dialog
          modal={!tutorialActive}
          open={!mapContextReadOnly && areaPickerOpen}
          onOpenChange={open => {
            if (!mapContextReadOnly || !open) onAreaPickerOpenChange(open);
          }}
        >
          <DialogTrigger asChild>
            <ToolbarButton
              type="button"
              data-tutorial-anchor="city-design-map-selection"
              aria-label={t('features.amendments.cityDesign.areaPicker.title')}
              pressed={areaPickerOpen}
              disabled={mapContextReadOnly}
              tooltip={t('features.amendments.cityDesign.areaPicker.title')}
            >
              <MapPinned className="size-4" />
            </ToolbarButton>
          </DialogTrigger>
          <DialogContent
            onInteractOutside={event => {
              if (
                tutorialActive &&
                event.target instanceof Element &&
                event.target.closest('[data-testid="app-tutorial-spotlight"]')
              ) {
                event.preventDefault();
              }
            }}
            onEscapeKeyDown={event => {
              if (tutorialActive) event.preventDefault();
            }}
            className={cn(
              'bg-background max-w-none overflow-hidden rounded-none border-0 p-0 sm:max-w-none',
              positionMode === 'container'
                ? 'inset-0 h-full w-full translate-x-0 translate-y-0'
                : 'h-dvh w-screen'
            )}
          >
            <DialogTitle className="sr-only">
              {t('features.amendments.cityDesign.areaPicker.title')}
            </DialogTitle>
            <div className="h-full overflow-auto">{areaPickerContent}</div>
          </DialogContent>
        </Dialog>

        <LayersDropdown
          osmLayerVisibility={osmLayerVisibility}
          showStreetMarkings={showStreetMarkings}
          onOsmLayerVisibilityChange={onOsmLayerVisibilityChange}
          onShowStreetMarkingsChange={onShowStreetMarkingsChange}
        />

        <Popover open={costSummaryOpen} onOpenChange={onCostSummaryOpenChange}>
          <PopoverTrigger asChild>
            <ToolbarButton
              type="button"
              aria-label={t('features.amendments.cityDesign.cost.title')}
              pressed={costSummaryOpen}
              tooltip={formatMinorCurrency(costSummary.totalCostMinor, costSummary.currency)}
            >
              <Calculator className="size-4" />
            </ToolbarButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-h-[min(72vh,46rem)] w-[min(48rem,calc(100vw-2rem))] overflow-auto p-0"
            sideOffset={8}
          >
            {costSummaryContent}
          </PopoverContent>
        </Popover>
      </ToolbarGroup>

      {!readOnly ? (
        <ToolbarGroup>
          {cityDesignElementSections.map(section => {
            const SectionIcon = sectionIcons[section.icon];
            const sectionLabel = t(section.labelKey);
            const sectionSelected = getSectionTools(section).some(tool =>
              isSectionToolSelected({ tool, selectedTool, selectedToolProperties })
            );

            return (
              <DropdownMenu key={section.layer} modal={false}>
                <DropdownMenuTrigger asChild>
                  <ToolbarButton
                    type="button"
                    data-tutorial-anchor={
                      section.layer === 'trees' ? 'city-design-trees-menu' : undefined
                    }
                    aria-label={sectionLabel}
                    pressed={sectionSelected}
                    isDropdown
                    tooltip={sectionLabel}
                  >
                    <SectionIcon className="size-4" />
                    <span className="sr-only">{sectionLabel}</span>
                  </ToolbarButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={section.layer === 'trees' ? 'end' : 'start'}
                  className="max-h-[70vh] w-72"
                  data-tutorial-anchor={
                    section.layer === 'trees' ? 'city-design-tree-placement-workspace' : undefined
                  }
                >
                  <DropdownMenuLabel className="text-muted-foreground flex items-center gap-2 text-xs">
                    <SectionIcon className="size-3.5" />
                    {sectionLabel}
                  </DropdownMenuLabel>
                  {getSectionTools(section).map(tool => {
                    const definition = cityDesignObjectRegistry[tool.objectType];
                    const Icon = objectIcons[tool.objectType];
                    const selected = isSectionToolSelected({
                      tool,
                      selectedTool,
                      selectedToolProperties,
                    });
                    const label = t(tool.labelKey ?? definition.labelKey);

                    return (
                      <DropdownMenuItem
                        key={tool.id}
                        data-tutorial-anchor={
                          section.layer === 'trees' &&
                          tool.propertyOverrides?.species === 'deciduous'
                            ? 'city-design-tree-deciduous'
                            : undefined
                        }
                        className={cn(selected && 'bg-primary/5 text-primary')}
                        onSelect={() =>
                          onToolChange(tool.objectType, tool.propertyOverrides, tool.widthOverride)
                        }
                      >
                        <Icon className="size-4" />
                        <span>{label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </ToolbarGroup>
      ) : null}

      <ToolbarGroup>
        <ObjectsDropdown
          hiddenCategorySet={hiddenCategorySet}
          hiddenObjectIdSet={hiddenObjectIdSet}
          objectGroups={objectGroups}
          readOnly={readOnly}
          selectedObjectId={selectedObjectId}
          getActionLabel={getActionLabel}
          getCategoryLabel={getCategoryLabel}
          onObjectCategoryDelete={onObjectCategoryDelete}
          onObjectCategoryVisibilityChange={onObjectCategoryVisibilityChange}
          onObjectDelete={onObjectDelete}
          onObjectSelect={onObjectSelect}
          onObjectVisibilityChange={onObjectVisibilityChange}
        />

        <ComparisonDropdown
          comparisonMode={comparisonMode}
          onComparisonModeChange={onComparisonModeChange}
        />

        {!readOnly ? (
          <>
            {!mapContextReadOnly ? (
              <>
                <ToolbarButton
                  type="button"
                  data-tutorial-anchor="city-design-load-osm"
                  aria-label={t('features.amendments.cityDesign.areaPicker.loadOsm')}
                  tooltip={osmError ?? t('features.amendments.cityDesign.areaPicker.loadOsm')}
                  loading={isLoadingOsm}
                  disabled={isLoadingOsm}
                  onClick={onLoadOsm}
                >
                  <Layers className={cn('size-4', osmError && 'text-destructive')} />
                </ToolbarButton>
              </>
            ) : null}

            <ToolbarButton
              type="button"
              data-tutorial-anchor="city-design-save"
              aria-label={t('features.amendments.cityDesign.save')}
              tooltip={saveError ?? t('features.amendments.cityDesign.save')}
              loading={isSaving}
              successState={!isDirty && !isSaving}
              disabled={isSaving || !isDirty}
              onClick={onSave}
            >
              <Save className={cn('size-4', saveError && 'text-destructive')} />
            </ToolbarButton>
          </>
        ) : null}
      </ToolbarGroup>

      {!readOnly && (selectedObject || selectedOsmWay) && (
        <ToolbarGroup>
          {selectedObject ? (
            <>
              <ToolbarButton
                type="button"
                aria-label={getActionLabel(
                  hiddenObjectIdSet.has(selectedObject.id) ? 'show' : 'hide',
                  selectedObjectLabel ?? selectedObject.id
                )}
                tooltip={getActionLabel(
                  hiddenObjectIdSet.has(selectedObject.id) ? 'show' : 'hide',
                  selectedObjectLabel ?? selectedObject.id
                )}
                onClick={() =>
                  onObjectVisibilityChange(
                    selectedObject.id,
                    hiddenObjectIdSet.has(selectedObject.id)
                  )
                }
              >
                {hiddenObjectIdSet.has(selectedObject.id) ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
              </ToolbarButton>
              <ToolbarButton
                type="button"
                aria-label={getActionLabel('remove', selectedObjectLabel ?? selectedObject.id)}
                tooltip={getActionLabel('remove', selectedObjectLabel ?? selectedObject.id)}
                disabled={readOnly}
                onClick={() => onObjectDelete(selectedObject.id)}
              >
                <Trash2 className="text-destructive size-4" />
              </ToolbarButton>
            </>
          ) : selectedOsmWay && !mapContextReadOnly ? (
            <ToolbarButton
              type="button"
              aria-label={t('features.amendments.cityDesign.inspector.removeFromMap')}
              tooltip={t('features.amendments.cityDesign.inspector.removeFromMap')}
              disabled={mapContextReadOnly}
              onClick={() => onOsmWayHide(selectedOsmWay.id)}
            >
              <EyeOff className="size-4" />
            </ToolbarButton>
          ) : null}
        </ToolbarGroup>
      )}
    </FixedToolbar>
  );
}

export function CityDesignSecondaryActionBarView({
  amendmentId,
  title,
  readOnly,
  currentUserId,
  collaborationDocumentId,
  existingCollaboratorIds,
  changeRequests,
  selectedChangeRequestId,
  showChangeRequests,
  changeRequestColorMode = 'natural',
  onShowChangeRequestsChange,
  onChangeRequestColorModeChange = () => undefined,
  onChangeRequestSelect,
}: CityDesignSecondaryActionBarViewProps) {
  const { t } = useTranslation();
  const colorModeIsTinted = changeRequestColorMode === 'tinted';

  return (
    <div className="scrollbar-hide mb-6 overflow-x-auto">
      <div className="flex w-max min-w-full items-center justify-end gap-4">
        <ShareButton
          url={`/amendment/${amendmentId}/citydesign`}
          title={title}
          description={t('features.amendments.cityDesign.workspaceDescription')}
          size="sm"
        />

        {currentUserId && collaborationDocumentId && !readOnly ? (
          <InviteCollaboratorDialog
            entityType="amendment"
            entityId={collaborationDocumentId}
            currentUserId={currentUserId}
            entityTitle={title}
            existingCollaboratorIds={existingCollaboratorIds}
          />
        ) : (
          <Button variant="outline" size="sm" disabled className="gap-2">
            <Users className="size-4" />
            {t('features.editor.inviteDialog.invite')}
          </Button>
        )}

        <ChangeRequestsDropdown
          changeRequests={changeRequests}
          selectedChangeRequestId={selectedChangeRequestId}
          onChangeRequestSelect={onChangeRequestSelect}
        />

        <Button
          type="button"
          variant={showChangeRequests ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => onShowChangeRequestsChange(!showChangeRequests)}
        >
          <Layers className="size-4" />
          {t('features.amendments.cityDesign.topbar.showCrOverlay')}
        </Button>

        <Button
          type="button"
          variant={colorModeIsTinted ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          aria-pressed={colorModeIsTinted}
          onClick={() => onChangeRequestColorModeChange(colorModeIsTinted ? 'natural' : 'tinted')}
        >
          <Palette className="size-4" />
          {t('features.amendments.cityDesign.topbar.colorCrChanges', 'Color changes')}
        </Button>
      </div>
    </div>
  );
}

function CityDesignModeToolbarButton({
  availableModes,
  canChangeMode,
  disabledModeReasons,
  mode,
  onModeChange,
}: {
  availableModes?: readonly SelectableEditingMode[];
  canChangeMode: boolean;
  disabledModeReasons: Partial<Record<SelectableEditingMode, string>>;
  mode: SelectableEditingMode;
  onModeChange: (mode: SelectableEditingMode) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentOption = getEditingModeOption(mode, t);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          type="button"
          aria-label={currentOption.label}
          pressed={open}
          tooltip={t('plateJs.toolbar.editingMode')}
        >
          <currentOption.Icon className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-80">
        {!canChangeMode ? (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">
            {t('plateJs.toolbar.mode.viewOnly')}
          </div>
        ) : null}
        <EditingModeMenuItems
          modes={availableModes}
          showAutomaticEventModes={!availableModes}
          value={mode}
          disabled={!canChangeMode}
          disabledModeReasons={disabledModeReasons}
          onValueChange={nextMode => {
            void onModeChange(nextMode);
            setOpen(false);
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LayersDropdown({
  osmLayerVisibility,
  showStreetMarkings,
  onOsmLayerVisibilityChange,
  onShowStreetMarkingsChange,
}: Pick<
  CityDesignTopBarViewProps,
  | 'osmLayerVisibility'
  | 'showStreetMarkings'
  | 'onOsmLayerVisibilityChange'
  | 'onShowStreetMarkingsChange'
>) {
  const { t } = useTranslation();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          type="button"
          aria-label={t('features.amendments.cityDesign.topbar.layers')}
          isDropdown
          tooltip={t('features.amendments.cityDesign.topbar.layers')}
        >
          <Layers className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {cityDesignElementSections.map(section => {
          const Icon = sectionIcons[section.icon];
          const label = t(section.labelKey);
          const visible = osmLayerVisibility[section.layer];

          return (
            <DropdownMenuCheckboxItem
              key={section.layer}
              checked={visible}
              onCheckedChange={checked =>
                onOsmLayerVisibilityChange(section.layer, checked === true)
              }
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showStreetMarkings}
          onCheckedChange={checked => onShowStreetMarkingsChange(checked === true)}
        >
          <Highlighter className="size-4" />
          <span>{t('features.amendments.cityDesign.osmLayers.streetMarkings')}</span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ObjectsDropdown({
  hiddenCategorySet,
  hiddenObjectIdSet,
  objectGroups,
  readOnly,
  selectedObjectId,
  getActionLabel,
  getCategoryLabel,
  onObjectCategoryDelete,
  onObjectCategoryVisibilityChange,
  onObjectDelete,
  onObjectSelect,
  onObjectVisibilityChange,
}: {
  hiddenCategorySet: Set<CityDesignObjectCategory>;
  hiddenObjectIdSet: Set<string>;
  objectGroups: { category: CityDesignObjectCategory; objects: CityDesignObject[] }[];
  readOnly: boolean;
  selectedObjectId: string | null;
  getActionLabel: (action: 'hide' | 'remove' | 'select' | 'show', label: string) => string;
  getCategoryLabel: (category: CityDesignObjectCategory) => string;
  onObjectCategoryDelete: (category: CityDesignObjectCategory) => void;
  onObjectCategoryVisibilityChange: (category: CityDesignObjectCategory, visible: boolean) => void;
  onObjectDelete: (objectId: string) => void;
  onObjectSelect: (objectId: string | null) => void;
  onObjectVisibilityChange: (objectId: string, visible: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          type="button"
          aria-label={t('features.amendments.cityDesign.topbar.objects')}
          isDropdown
          tooltip={t('features.amendments.cityDesign.topbar.objects')}
        >
          <PanelRight className="size-4" />
          <span className="sr-only">{t('features.amendments.cityDesign.topbar.objects')}</span>
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-80">
        <DropdownMenuLabel>{t('features.amendments.cityDesign.topbar.objects')}</DropdownMenuLabel>
        {objectGroups.length === 0 ? (
          <DropdownMenuItem disabled>
            {t('features.amendments.cityDesign.topbar.noObjects')}
          </DropdownMenuItem>
        ) : (
          objectGroups.map(group => {
            const CategoryIcon = categoryIcons[group.category];
            const categoryLabel = getCategoryLabel(group.category);
            const categoryHidden = hiddenCategorySet.has(group.category);

            return (
              <div key={group.category}>
                <DropdownMenuLabel className="text-muted-foreground flex items-center gap-2 text-xs">
                  <CategoryIcon className="size-3.5" />
                  <span>{categoryLabel}</span>
                  <span className="ml-auto">{group.objects.length}</span>
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => onObjectCategoryVisibilityChange(group.category, categoryHidden)}
                >
                  {categoryHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  {getActionLabel(categoryHidden ? 'show' : 'hide', categoryLabel)}
                </DropdownMenuItem>
                {!readOnly ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onObjectCategoryDelete(group.category)}
                  >
                    <Trash2 className="size-4" />
                    {getActionLabel('remove', categoryLabel)}
                  </DropdownMenuItem>
                ) : null}
                {group.objects.map(object => {
                  const Icon = objectIcons[object.type];
                  const hidden = hiddenObjectIdSet.has(object.id);
                  const label = t(
                    getCityDesignObjectVariantLabelKey(object) ??
                      cityDesignObjectRegistry[object.type].labelKey
                  );

                  return (
                    <div key={object.id} className="pl-2">
                      <DropdownMenuItem
                        className={cn(
                          selectedObjectId === object.id && 'bg-primary/5 text-primary'
                        )}
                        onSelect={() => onObjectSelect(object.id)}
                      >
                        <Icon className="size-4" />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {object.id.slice(0, 6)}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => onObjectVisibilityChange(object.id, hidden)}
                      >
                        {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        {getActionLabel(hidden ? 'show' : 'hide', label)}
                      </DropdownMenuItem>
                      {!readOnly ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onObjectDelete(object.id)}
                        >
                          <Trash2 className="size-4" />
                          {getActionLabel('remove', label)}
                        </DropdownMenuItem>
                      ) : null}
                    </div>
                  );
                })}
                <DropdownMenuSeparator />
              </div>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ComparisonDropdown({
  comparisonMode,
  onComparisonModeChange,
}: Pick<CityDesignTopBarViewProps, 'comparisonMode' | 'onComparisonModeChange'>) {
  const { t } = useTranslation();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          type="button"
          aria-label={t('features.amendments.cityDesign.cost.comparison')}
          isDropdown
          tooltip={t('features.amendments.cityDesign.cost.comparison')}
        >
          <GitCompareArrows className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuRadioGroup
          value={comparisonMode}
          onValueChange={value => onComparisonModeChange(value as CityDesignComparisonMode)}
        >
          {comparisonModes.map(item => (
            <DropdownMenuRadioItem key={item.mode} value={item.mode}>
              {t(item.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChangeRequestsDropdown({
  changeRequests,
  selectedChangeRequestId,
  onChangeRequestSelect,
}: Pick<
  CityDesignSecondaryActionBarViewProps,
  'changeRequests' | 'selectedChangeRequestId' | 'onChangeRequestSelect'
>) {
  const { t } = useTranslation();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <MessageSquare className="size-4" />
          {t('features.amendments.cityDesign.topbar.changeRequestsCount', {
            count: changeRequests.length,
          })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-80">
        <DropdownMenuLabel>
          {t('features.amendments.cityDesign.topbar.changeRequests')}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onChangeRequestSelect(null)}>
          {t('features.amendments.cityDesign.topbar.allChangeRequests')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {changeRequests.length === 0 ? (
          <DropdownMenuItem disabled>
            {t('features.amendments.cityDesign.topbar.noChangeRequests')}
          </DropdownMenuItem>
        ) : (
          changeRequests.map(changeRequest => (
            <DropdownMenuItem
              key={changeRequest.id}
              className={cn(
                selectedChangeRequestId === changeRequest.id && 'bg-primary/5 text-primary'
              )}
              onSelect={() => onChangeRequestSelect(changeRequest.id)}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  getChangeRequestToneClassName(getCityDesignChangeRequestTone(changeRequest))
                )}
              />
              <span className="min-w-0 flex-1 truncate">
                {formatCityDesignChangeRequestTitle(changeRequest)}
              </span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {formatCityDesignChangeRequestIdentifier(changeRequest)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getChangeRequestToneClassName(tone: string) {
  switch (tone) {
    case 'add':
      return 'bg-[var(--badge-success-border)]';
    case 'remove':
      return 'bg-[var(--badge-danger-border)]';
    case 'update':
      return 'bg-[var(--badge-info-border)]';
    default:
      return 'bg-muted-foreground/45';
  }
}

import { EyeOff, MousePointer2, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignCostLine,
  StreetDesignInteractionMode,
  StreetDesignObject,
  StreetDesignObjectType,
  StreetDesignOsmWay,
  StreetDesignPlacementSettings,
  StreetDesignPropertyValue,
} from '../types';
import {
  formatMinorCurrency,
  getStreetDesignCostCatalogEntry,
} from '../logic/streetDesignCostCatalog';
import { majorToMinor, minorToMajor } from '@/features/shared/logic/currency';
import { getStreetDesignCostLine } from '../logic/streetDesignCosting';
import { getStreetDesignObjectDefinition } from '../logic/streetDesignObjectRegistry';
import { getStreetDesignGeometryRotationDeg } from '../logic/streetDesignPlacement';
import {
  getStreetDesignOsmFeatureLayer,
  getStreetDesignOsmFeaturePoints,
} from '../logic/streetDesignOsm';
import {
  getStreetDesignObjectVariantLabelKey,
  getStreetDesignVariantLabelKey,
} from '../logic/streetDesignVariantCatalog';

interface StreetDesignInspectorViewProps {
  selectedObject: StreetDesignObject | null;
  selectedOsmWay: StreetDesignOsmWay | null;
  selectedObjectCostLine: StreetDesignCostLine | null;
  selectedTool: StreetDesignObjectType;
  interactionMode: StreetDesignInteractionMode;
  placementSettings: StreetDesignPlacementSettings;
  placementPreview: CorridorGeometry | PathCorridorGeometry | null;
  placementMode: 'drag_band' | 'path' | null;
  readOnly: boolean;
  currency?: string;
  onPlacementPropertyChange: (key: string, value: StreetDesignPropertyValue) => void;
  onPlacementWidthChange: (width: number) => void;
  onPlacementRotationChange: (rotationDeg: number) => void;
  onPlacementUnitCostChange: (unitCostMinor: number | null) => void;
  onPropertyChange: (objectId: string, key: string, value: StreetDesignPropertyValue) => void;
  onWidthChange: (objectId: string, width: number) => void;
  onRotationChange: (objectId: string, rotationDeg: number) => void;
  onUnitCostChange: (objectId: string, unitCostMinor: number | null) => void;
  onDeleteObject: (objectId: string) => void;
  onHideOsmWay: (osmWayId: string) => void;
}

function asInputValue(value: StreetDesignPropertyValue | undefined) {
  if (value == null) return '';
  return String(value);
}

function getPlacementTotalMinor(args: {
  placementSettings: StreetDesignPlacementSettings;
  placementPreview: CorridorGeometry | PathCorridorGeometry | null;
  currency: string;
}) {
  const definition = getStreetDesignObjectDefinition(args.placementSettings.type);
  const catalogEntry = getStreetDesignCostCatalogEntry(definition.type, args.currency);
  const unitCostMinor = args.placementSettings.customUnitCostMinor ?? catalogEntry.unitCostMinor;

  if (!args.placementPreview) {
    return unitCostMinor;
  }

  return getStreetDesignCostLine({
    id: 'placement-preview',
    type: args.placementSettings.type,
    geometry: args.placementPreview,
    properties: args.placementSettings.properties,
    cost: {
      rule: definition.costRule,
      currency: args.currency,
      suggestedUnitCostMinor: catalogEntry.unitCostMinor,
      ...(args.placementSettings.customUnitCostMinor == null
        ? {}
        : { customUnitCostMinor: args.placementSettings.customUnitCostMinor }),
    },
  }).totalCostMinor;
}

function getPlacementRotationValue(
  placementSettings: StreetDesignPlacementSettings,
  placementPreview: CorridorGeometry | PathCorridorGeometry | null
) {
  if (placementSettings.rotationLocked || !placementPreview) return placementSettings.rotationDeg;

  return getStreetDesignGeometryRotationDeg(placementPreview);
}

function getOsmLayerLabelKey(layer: ReturnType<typeof getStreetDesignOsmFeatureLayer>) {
  if (layer === 'bike_lane') return 'features.amendments.streetscape.osmLayers.bikeLane';
  if (layer === 'street_furniture')
    return 'features.amendments.streetscape.osmLayers.streetFurniture';
  if (layer === 'landuse_context')
    return 'features.amendments.streetscape.osmLayers.landuseContext';
  return `features.amendments.streetscape.osmLayers.${layer}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatMeters(value: number) {
  return `${value.toFixed(Math.abs(value) < 1 ? 2 : 1)} m`;
}

function getRelevantOsmTags(tags: Record<string, string> | undefined) {
  if (!tags) return [];

  const relevantPrefixes = [
    'highway',
    'natural',
    'amenity',
    'parking',
    'parking:',
    'cycleway',
    'cycleway:',
    'sidewalk',
    'sidewalk:',
    'railway',
    'public_transport',
    'barrier',
    'traffic_calming',
    'crossing',
    'access',
    'bridge',
    'bridge:',
    'tunnel',
    'layer',
    'ele',
    'incline',
    'step_count',
    'embankment',
    'cutting',
    'man_made',
    'area:highway',
    'maxheight',
    'maxheight:',
    'min_height',
    'clearance',
    'shop',
    'office',
    'tourism',
    'leisure',
    'landuse',
    'building',
    'emergency',
    'lanes',
    'oneway',
    'width',
    'height',
    'surface',
  ];

  return Object.entries(tags)
    .filter(([key]) => relevantPrefixes.some(prefix => key === prefix || key.startsWith(prefix)))
    .slice(0, 8);
}

export function StreetDesignInspectorView({
  selectedObject,
  selectedOsmWay,
  selectedObjectCostLine,
  selectedTool,
  interactionMode,
  placementSettings,
  placementPreview,
  placementMode,
  readOnly,
  currency = 'EUR',
  onPlacementPropertyChange,
  onPlacementWidthChange,
  onPlacementRotationChange,
  onPlacementUnitCostChange,
  onPropertyChange,
  onWidthChange,
  onRotationChange,
  onUnitCostChange,
  onDeleteObject,
  onHideOsmWay,
}: StreetDesignInspectorViewProps) {
  const { t } = useTranslation();
  const fieldLabel = (labelKey: string, unit?: string) =>
    unit
      ? t('features.amendments.streetscape.inspector.fieldWithUnit', {
          label: t(labelKey),
          unit,
        })
      : t(labelKey);

  if (interactionMode === 'place') {
    const definition = getStreetDesignObjectDefinition(selectedTool);
    const objectLabel = t(
      getStreetDesignVariantLabelKey(selectedTool, placementSettings.properties) ??
        definition.labelKey
    );
    const hasWidth = definition.toolMode !== 'point' || definition.defaultWidth != null;
    const catalogEntry = getStreetDesignCostCatalogEntry(selectedTool, currency);
    const unitCostMajor = minorToMajor(
      placementSettings.customUnitCostMinor ?? catalogEntry.unitCostMinor,
      currency
    );
    const totalMinor = getPlacementTotalMinor({ placementSettings, placementPreview, currency });
    const rotationValue = getPlacementRotationValue(placementSettings, placementPreview);

    return (
      <aside className="bg-background/95 min-w-0 border-b p-4 shadow-sm xl:border-b-0 xl:border-l">
        <div className="mb-4">
          <p className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium uppercase">
            <SlidersHorizontal className="size-3.5" />
            {t('features.amendments.streetscape.inspector.place')}
          </p>
          <h2 className="text-base font-semibold">{objectLabel}</h2>
          <p className="text-muted-foreground text-xs">
            {placementMode
              ? t('features.amendments.streetscape.inspector.activeDraft')
              : t('features.amendments.streetscape.inspector.nextElementSettings')}
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-muted/20 grid grid-cols-2 gap-2 rounded-md border p-2">
            {hasWidth ? (
              <div className="space-y-1">
                <Label className="text-xs">
                  {t('features.amendments.streetscape.inspector.width')}
                </Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={placementSettings.width}
                  disabled={readOnly}
                  onChange={event => onPlacementWidthChange(Number(event.target.value))}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.rotation')}
              </Label>
              <Input
                type="number"
                step={1}
                value={Number(rotationValue.toFixed(1))}
                disabled={readOnly}
                onChange={event => onPlacementRotationChange(Number(event.target.value))}
              />
            </div>
            {placementPreview ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {t('features.amendments.streetscape.inspector.length')}
                  </Label>
                  <Input value={placementPreview.length.toFixed(1)} disabled />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {t('features.amendments.streetscape.inspector.area')}
                  </Label>
                  <Input value={placementPreview.area.toFixed(1)} disabled />
                </div>
              </>
            ) : null}
          </div>

          {definition.propertySchema.map(field => {
            const value = placementSettings.properties[field.key];

            if (field.fieldType === 'boolean') {
              return (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    disabled={readOnly}
                    onChange={event => onPlacementPropertyChange(field.key, event.target.checked)}
                  />
                  {t(field.labelKey)}
                </label>
              );
            }

            if (field.fieldType === 'select') {
              return (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">{t(field.labelKey)}</Label>
                  <Select
                    value={asInputValue(value)}
                    disabled={readOnly}
                    onValueChange={nextValue => onPlacementPropertyChange(field.key, nextValue)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            if (field.fieldType === 'combobox') {
              const datalistId = `street-design-placement-${field.key}`;

              return (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">{fieldLabel(field.labelKey, field.unit)}</Label>
                  <Input
                    type="text"
                    aria-label={fieldLabel(field.labelKey, field.unit)}
                    list={datalistId}
                    value={asInputValue(value)}
                    disabled={readOnly}
                    onChange={event => onPlacementPropertyChange(field.key, event.target.value)}
                  />
                  <datalist id={datalistId}>
                    {(field.options ?? []).map(option => (
                      <option key={option.value} value={option.value} label={t(option.labelKey)} />
                    ))}
                  </datalist>
                </div>
              );
            }

            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">{fieldLabel(field.labelKey, field.unit)}</Label>
                <Input
                  type={field.fieldType === 'number' ? 'number' : 'text'}
                  aria-label={fieldLabel(field.labelKey, field.unit)}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={asInputValue(value)}
                  disabled={readOnly}
                  onChange={event =>
                    onPlacementPropertyChange(
                      field.key,
                      field.fieldType === 'number' ? Number(event.target.value) : event.target.value
                    )
                  }
                />
              </div>
            );
          })}

          <div className="border-border bg-muted/20 mt-4 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">
                  {t('features.amendments.streetscape.inspector.price')}
                </Label>
                <Input
                  type="number"
                  aria-label={t('features.amendments.streetscape.inspector.price')}
                  min={0}
                  step={0.01}
                  value={unitCostMajor}
                  disabled={readOnly}
                  onChange={event => {
                    const value = event.target.value;
                    onPlacementUnitCostChange(
                      value === '' ? null : Math.max(0, majorToMinor(Number(value), currency))
                    );
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">
                  {t('features.amendments.streetscape.inspector.total')}
                </Label>
                <Input value={formatMinorCurrency(totalMinor, currency)} disabled />
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              {t('features.amendments.streetscape.inspector.suggestedCost', {
                cost: formatMinorCurrency(catalogEntry.unitCostMinor, currency),
              })}
            </p>
            {placementSettings.customUnitCostMinor != null ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-auto px-0 text-xs"
                disabled={readOnly}
                onClick={() => onPlacementUnitCostChange(null)}
              >
                {t('features.amendments.streetscape.inspector.resetToSuggestedPrice')}
              </Button>
            ) : null}
          </div>
        </div>
      </aside>
    );
  }

  if (!selectedObject) {
    if (selectedOsmWay) {
      const osmFeaturePoints = getStreetDesignOsmFeaturePoints(selectedOsmWay);
      const osmLayer = getStreetDesignOsmFeatureLayer(selectedOsmWay.kind);
      const osmKindLabel = t(getOsmLayerLabelKey(osmLayer));
      const relevantTags = getRelevantOsmTags(selectedOsmWay.tags);
      const osmElevationDetails = [
        selectedOsmWay.structureKind
          ? `${t('features.amendments.streetscape.inspector.structure')}: ${
              selectedOsmWay.structureKind
            }`
          : null,
        selectedOsmWay.elevationSource
          ? `${t('features.amendments.streetscape.inspector.elevationSource')}: ${
              selectedOsmWay.elevationSource
            }`
          : null,
        selectedOsmWay.incline
          ? `${t('features.amendments.streetscape.inspector.incline')}: ${selectedOsmWay.incline}`
          : null,
        isFiniteNumber(selectedOsmWay.stepCount)
          ? `${t('features.amendments.streetscape.inspector.stepCount', {
              count: selectedOsmWay.stepCount,
            })}: ${selectedOsmWay.stepCount}`
          : null,
        isFiniteNumber(selectedOsmWay.clearanceMeters)
          ? `${t('features.amendments.streetscape.inspector.clearance')}: ${formatMeters(
              selectedOsmWay.clearanceMeters
            )}`
          : null,
      ].filter((value): value is string => Boolean(value));

      return (
        <aside className="bg-background/95 min-w-0 border-b p-4 shadow-sm xl:border-b-0 xl:border-l">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium uppercase">
                <MousePointer2 className="size-3.5" />
                {t('features.amendments.streetscape.inspector.existing')}
              </p>
              <h2 className="text-base font-semibold">
                {selectedOsmWay.label ?? t('features.amendments.streetscape.inspector.osmFallback')}
              </h2>
              <p className="text-muted-foreground text-xs">
                {osmKindLabel}
                {selectedOsmWay.subkind ? ` · ${selectedOsmWay.subkind}` : ''} · {selectedOsmWay.id}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              title={t('features.amendments.streetscape.inspector.removeFromMap')}
              disabled={readOnly}
              onClick={() => onHideOsmWay(selectedOsmWay.id)}
            >
              <EyeOff className="size-4" />
            </Button>
          </div>
          <div className="grid gap-2 text-sm">
            <div className="bg-muted/20 rounded-md border px-3 py-2">
              <p className="text-muted-foreground text-xs">
                {t('features.amendments.streetscape.inspector.points', {
                  count: osmFeaturePoints.length,
                })}
              </p>
              <p className="font-semibold">{osmFeaturePoints.length}</p>
            </div>
            {selectedOsmWay.widthMeters ? (
              <div className="bg-muted/20 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.streetscape.inspector.width')}
                </p>
                <p className="font-semibold">{selectedOsmWay.widthMeters.toFixed(1)} m</p>
              </div>
            ) : null}
            {selectedOsmWay.height ? (
              <div className="bg-muted/20 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.streetscape.inspector.height')}
                </p>
                <p className="font-semibold">{selectedOsmWay.height.toFixed(1)} m</p>
              </div>
            ) : null}
            {isFiniteNumber(selectedOsmWay.deckElevationMeters) ? (
              <div className="bg-muted/20 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.streetscape.inspector.deckElevation')}
                </p>
                <p className="font-semibold">{formatMeters(selectedOsmWay.deckElevationMeters)}</p>
              </div>
            ) : null}
            {isFiniteNumber(selectedOsmWay.baseElevationMeters) &&
            selectedOsmWay.baseElevationMeters !== 0 ? (
              <div className="bg-muted/20 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.streetscape.inspector.baseElevation')}
                </p>
                <p className="font-semibold">{formatMeters(selectedOsmWay.baseElevationMeters)}</p>
              </div>
            ) : null}
            {isFiniteNumber(selectedOsmWay.layerIndex) && selectedOsmWay.layerIndex !== 0 ? (
              <div className="bg-muted/20 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.streetscape.inspector.layer')}
                </p>
                <p className="font-semibold">{selectedOsmWay.layerIndex}</p>
              </div>
            ) : null}
            {osmElevationDetails.length > 0 ? (
              <div className="bg-muted/20 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.streetscape.inspector.elevationSource')}
                </p>
                <p className="font-semibold">{osmElevationDetails.join(' · ')}</p>
              </div>
            ) : null}
            {selectedOsmWay.semanticUse || selectedOsmWay.level || selectedOsmWay.access ? (
              <div className="bg-muted/20 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.streetscape.inspector.tags')}
                </p>
                <p className="font-semibold">
                  {[selectedOsmWay.semanticUse, selectedOsmWay.level, selectedOsmWay.access]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ) : null}
            {relevantTags.length > 0 ? (
              <div className="bg-muted/20 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.streetscape.inspector.tags')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {relevantTags.map(([key, value]) => (
                    <span
                      key={key}
                      className="bg-background/80 rounded border px-1.5 py-0.5 text-[11px]"
                    >
                      {key}={value}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      );
    }

    return (
      <aside className="bg-background/95 min-w-0 border-b p-4 shadow-sm xl:border-b-0 xl:border-l">
        <div className="bg-muted/20 rounded-md border border-dashed p-4">
          <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium uppercase">
            <SlidersHorizontal className="size-3.5" />
            {t('features.amendments.streetscape.inspector.title')}
          </p>
          <h2 className="text-base font-semibold">
            {t('features.amendments.streetscape.inspector.noSelection')}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {t('features.amendments.streetscape.inspector.noSelectionDescription')}
          </p>
        </div>
      </aside>
    );
  }

  const definition = getStreetDesignObjectDefinition(selectedObject.type);
  const objectLabel = t(
    getStreetDesignObjectVariantLabelKey(selectedObject) ?? definition.labelKey
  );
  const unitCostMajor = minorToMajor(
    selectedObject.cost.customUnitCostMinor ?? selectedObject.cost.suggestedUnitCostMinor,
    selectedObject.cost.currency
  );

  return (
    <aside className="bg-background/95 min-w-0 border-b p-4 shadow-sm xl:border-b-0 xl:border-l">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium uppercase">
            <SlidersHorizontal className="size-3.5" />
            {t('features.amendments.streetscape.inspector.title')}
          </p>
          <h2 className="text-base font-semibold">{objectLabel}</h2>
          <p className="text-muted-foreground text-xs">{selectedObject.id.slice(0, 8)}</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          title={t('features.amendments.streetscape.actions.remove', { label: objectLabel })}
          disabled={readOnly}
          onClick={() => onDeleteObject(selectedObject.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {selectedObject.geometry.kind === 'corridor' ||
        selectedObject.geometry.kind === 'path_corridor' ? (
          <div className="bg-muted/20 grid grid-cols-2 gap-2 rounded-md border p-2">
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.width')}
              </Label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={selectedObject.geometry.width}
                disabled={readOnly}
                onChange={event => onWidthChange(selectedObject.id, Number(event.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.length')}
              </Label>
              <Input value={selectedObject.geometry.length.toFixed(1)} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.area')}
              </Label>
              <Input value={selectedObject.geometry.area.toFixed(1)} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.rotation')}
              </Label>
              <Input
                type="number"
                step={1}
                value={Number(
                  getStreetDesignGeometryRotationDeg(selectedObject.geometry).toFixed(1)
                )}
                disabled={readOnly}
                onChange={event => onRotationChange(selectedObject.id, Number(event.target.value))}
              />
            </div>
          </div>
        ) : null}

        {selectedObject.geometry.kind === 'point' ? (
          <div className="bg-muted/20 rounded-md border p-2">
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.rotation')}
              </Label>
              <Input
                type="number"
                step={1}
                value={Number(
                  getStreetDesignGeometryRotationDeg(selectedObject.geometry).toFixed(1)
                )}
                disabled={readOnly}
                onChange={event => onRotationChange(selectedObject.id, Number(event.target.value))}
              />
            </div>
          </div>
        ) : null}

        {definition.propertySchema.map(field => {
          const value = selectedObject.properties[field.key];

          if (field.fieldType === 'boolean') {
            return (
              <label key={field.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  disabled={readOnly}
                  onChange={event =>
                    onPropertyChange(selectedObject.id, field.key, event.target.checked)
                  }
                />
                {t(field.labelKey)}
              </label>
            );
          }

          if (field.fieldType === 'select') {
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">{t(field.labelKey)}</Label>
                <Select
                  value={asInputValue(value)}
                  disabled={readOnly}
                  onValueChange={nextValue =>
                    onPropertyChange(selectedObject.id, field.key, nextValue)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (field.fieldType === 'combobox') {
            const datalistId = `street-design-object-${selectedObject.id}-${field.key}`;

            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">{fieldLabel(field.labelKey, field.unit)}</Label>
                <Input
                  type="text"
                  aria-label={fieldLabel(field.labelKey, field.unit)}
                  list={datalistId}
                  value={asInputValue(value)}
                  disabled={readOnly}
                  onChange={event =>
                    onPropertyChange(selectedObject.id, field.key, event.target.value)
                  }
                />
                <datalist id={datalistId}>
                  {(field.options ?? []).map(option => (
                    <option key={option.value} value={option.value} label={t(option.labelKey)} />
                  ))}
                </datalist>
              </div>
            );
          }

          const fieldMeta = field as {
            unit?: string;
            min?: number;
            max?: number;
            step?: number;
          };
          const fieldUnit = fieldMeta.unit;
          const fieldMin = fieldMeta.min;
          const fieldMax = fieldMeta.max;
          const fieldStep = fieldMeta.step;
          return (
            <div key={field.key} className="space-y-1">
              <Label className="text-xs">{fieldLabel(field.labelKey, fieldUnit)}</Label>
              <Input
                type={field.fieldType === 'number' ? 'number' : 'text'}
                aria-label={fieldLabel(field.labelKey, fieldUnit)}
                min={fieldMin}
                max={fieldMax}
                step={fieldStep}
                value={asInputValue(value)}
                disabled={readOnly}
                onChange={event =>
                  onPropertyChange(
                    selectedObject.id,
                    field.key,
                    field.fieldType === 'number' ? Number(event.target.value) : event.target.value
                  )
                }
              />
            </div>
          );
        })}

        <div className="border-border bg-muted/20 mt-4 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.price')}
              </Label>
              <Input
                type="number"
                aria-label={t('features.amendments.streetscape.inspector.price')}
                min={0}
                step={0.01}
                value={unitCostMajor}
                disabled={readOnly}
                onChange={event => {
                  const value = event.target.value;
                  onUnitCostChange(
                    selectedObject.id,
                    value === ''
                      ? null
                      : Math.max(0, majorToMinor(Number(value), selectedObject.cost.currency))
                  );
                }}
              />
            </div>
            <div>
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.total')}
              </Label>
              <Input
                value={formatMinorCurrency(
                  selectedObjectCostLine?.totalCostMinor ?? 0,
                  selectedObject.cost.currency
                )}
                disabled
              />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            {t('features.amendments.streetscape.inspector.suggestedCost', {
              cost: formatMinorCurrency(
                selectedObject.cost.suggestedUnitCostMinor,
                selectedObject.cost.currency
              ),
            })}
          </p>
          {selectedObject.cost.customUnitCostMinor != null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-auto px-0 text-xs"
              disabled={readOnly}
              onClick={() => onUnitCostChange(selectedObject.id, null)}
            >
              {t('features.amendments.streetscape.inspector.resetToSuggestedPrice')}
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

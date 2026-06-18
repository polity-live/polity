import { EyeOff, MousePointer2, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
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
import { formatMinorCurrency } from '../logic/streetDesignCostCatalog';
import { getStreetDesignCostLine } from '../logic/streetDesignCosting';
import { getStreetDesignObjectDefinition } from '../logic/streetDesignObjectRegistry';
import { getStreetDesignGeometryRotationDeg } from '../logic/streetDesignPlacement';

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
}) {
  const definition = getStreetDesignObjectDefinition(args.placementSettings.type);
  const unitCostMinor =
    args.placementSettings.customUnitCostMinor ?? definition.suggestedUnitCostMinor;

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
      currency: 'EUR',
      suggestedUnitCostMinor: definition.suggestedUnitCostMinor,
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
  if (interactionMode === 'place') {
    const definition = getStreetDesignObjectDefinition(selectedTool);
    const hasWidth = definition.toolMode !== 'point' || definition.defaultWidth != null;
    const unitCostEuro =
      (placementSettings.customUnitCostMinor ?? definition.suggestedUnitCostMinor) / 100;
    const totalMinor = getPlacementTotalMinor({ placementSettings, placementPreview });
    const rotationValue = getPlacementRotationValue(placementSettings, placementPreview);

    return (
      <aside className="bg-background/95 min-w-0 border-b p-4 shadow-sm xl:border-b-0 xl:border-l">
        <div className="mb-4">
          <p className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium uppercase">
            <SlidersHorizontal className="size-3.5" />
            Platzieren
          </p>
          <h2 className="text-base font-semibold">{definition.label}</h2>
          <p className="text-muted-foreground text-xs">
            {placementMode ? 'Aktiver Entwurf' : 'Einstellungen fuer das naechste Element'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-muted/20 grid grid-cols-2 gap-2 rounded-md border p-2">
            {hasWidth ? (
              <div className="space-y-1">
                <Label className="text-xs">Breite</Label>
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
              <Label className="text-xs">Rotation</Label>
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
                  <Label className="text-xs">Laenge</Label>
                  <Input value={placementPreview.length.toFixed(1)} disabled />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Flaeche</Label>
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
                  {field.label}
                </label>
              );
            }

            if (field.fieldType === 'select') {
              return (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">{field.label}</Label>
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
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">
                  {field.label}
                  {field.unit ? ` (${field.unit})` : ''}
                </Label>
                <Input
                  type={field.fieldType === 'number' ? 'number' : 'text'}
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
                <Label className="text-xs">Preis</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={unitCostEuro}
                  disabled={readOnly}
                  onChange={event =>
                    onPlacementUnitCostChange(Math.round(Number(event.target.value) * 100))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Summe</Label>
                <Input value={formatMinorCurrency(totalMinor)} disabled />
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Vorschlag: {formatMinorCurrency(definition.suggestedUnitCostMinor)}
            </p>
          </div>
        </div>
      </aside>
    );
  }

  if (!selectedObject) {
    if (selectedOsmWay) {
      return (
        <aside className="bg-background/95 min-w-0 border-b p-4 shadow-sm xl:border-b-0 xl:border-l">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium uppercase">
                <MousePointer2 className="size-3.5" />
                Bestand
              </p>
              <h2 className="text-base font-semibold">
                {selectedOsmWay.label ?? 'OSM-Bestandsobjekt'}
              </h2>
              <p className="text-muted-foreground text-xs">
                {selectedOsmWay.kind} · {selectedOsmWay.id}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              title="Aus Karte entfernen"
              disabled={readOnly}
              onClick={() => onHideOsmWay(selectedOsmWay.id)}
            >
              <EyeOff className="size-4" />
            </Button>
          </div>
          <div className="grid gap-2 text-sm">
            <div className="bg-muted/20 rounded-md border px-3 py-2">
              <p className="text-muted-foreground text-xs">Punkte</p>
              <p className="font-semibold">{selectedOsmWay.points.length}</p>
            </div>
            {selectedOsmWay.height ? (
              <div className="bg-muted/20 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-xs">Hoehe</p>
                <p className="font-semibold">{selectedOsmWay.height.toFixed(1)} m</p>
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
            Inspector
          </p>
          <h2 className="text-base font-semibold">Kein Element ausgewaehlt</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Waehle ein platziertes Element oder ein Bestandsobjekt im 3D-Modell aus.
          </p>
        </div>
      </aside>
    );
  }

  const definition = getStreetDesignObjectDefinition(selectedObject.type);
  const unitCostEuro =
    (selectedObject.cost.customUnitCostMinor ?? selectedObject.cost.suggestedUnitCostMinor) / 100;

  return (
    <aside className="bg-background/95 min-w-0 border-b p-4 shadow-sm xl:border-b-0 xl:border-l">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium uppercase">
            <SlidersHorizontal className="size-3.5" />
            Inspector
          </p>
          <h2 className="text-base font-semibold">{definition.label}</h2>
          <p className="text-muted-foreground text-xs">{selectedObject.id.slice(0, 8)}</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          title="Loeschen"
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
              <Label className="text-xs">Breite</Label>
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
              <Label className="text-xs">Laenge</Label>
              <Input value={selectedObject.geometry.length.toFixed(1)} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Flaeche</Label>
              <Input value={selectedObject.geometry.area.toFixed(1)} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rotation</Label>
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
              <Label className="text-xs">Rotation</Label>
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
                {field.label}
              </label>
            );
          }

          if (field.fieldType === 'select') {
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">{field.label}</Label>
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
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          const fieldLabel = String(field.label);

          return (
            <div key={field.key} className="space-y-1">
              <Label className="text-xs">
                {fieldLabel}
                {fieldUnit ? ` (${fieldUnit})` : ''}
              </Label>
              <Input
                type={field.fieldType === 'number' ? 'number' : 'text'}
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
              <Label className="text-xs">Preis</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={unitCostEuro}
                disabled={readOnly}
                onChange={event =>
                  onUnitCostChange(selectedObject.id, Math.round(Number(event.target.value) * 100))
                }
              />
            </div>
            <div>
              <Label className="text-xs">Summe</Label>
              <Input
                value={formatMinorCurrency(selectedObjectCostLine?.totalCostMinor ?? 0)}
                disabled
              />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Vorschlag: {formatMinorCurrency(selectedObject.cost.suggestedUnitCostMinor)}
          </p>
        </div>
      </div>
    </aside>
  );
}

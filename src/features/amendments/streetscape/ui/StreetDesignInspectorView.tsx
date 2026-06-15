import { Trash2 } from 'lucide-react';
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
  StreetDesignCostLine,
  StreetDesignObject,
  StreetDesignOsmWay,
  StreetDesignPropertyValue,
} from '../types';
import { formatMinorCurrency } from '../logic/streetDesignCostCatalog';
import { getStreetDesignObjectDefinition } from '../logic/streetDesignObjectRegistry';

interface StreetDesignInspectorViewProps {
  selectedObject: StreetDesignObject | null;
  selectedOsmWay: StreetDesignOsmWay | null;
  selectedObjectCostLine: StreetDesignCostLine | null;
  readOnly: boolean;
  onPropertyChange: (objectId: string, key: string, value: StreetDesignPropertyValue) => void;
  onWidthChange: (objectId: string, width: number) => void;
  onUnitCostChange: (objectId: string, unitCostMinor: number | null) => void;
  onDeleteObject: (objectId: string) => void;
  onHideOsmWay: (osmWayId: string) => void;
}

function asInputValue(value: StreetDesignPropertyValue | undefined) {
  if (value == null) return '';
  return String(value);
}

export function StreetDesignInspectorView({
  selectedObject,
  selectedOsmWay,
  selectedObjectCostLine,
  readOnly,
  onPropertyChange,
  onWidthChange,
  onUnitCostChange,
  onDeleteObject,
  onHideOsmWay,
}: StreetDesignInspectorViewProps) {
  if (!selectedObject) {
    if (selectedOsmWay) {
      return (
        <aside className="border-border bg-background rounded-md border p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">
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
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>Punkte: {selectedOsmWay.points.length}</p>
            {selectedOsmWay.height ? <p>Hoehe: {selectedOsmWay.height.toFixed(1)} m</p> : null}
          </div>
        </aside>
      );
    }

    return (
      <aside className="border-border bg-background rounded-md border p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Inspector</h2>
        <p className="text-muted-foreground mt-2 text-sm">Kein Element ausgewaehlt.</p>
      </aside>
    );
  }

  const definition = getStreetDesignObjectDefinition(selectedObject.type);
  const unitCostEuro =
    (selectedObject.cost.customUnitCostMinor ?? selectedObject.cost.suggestedUnitCostMinor) / 100;

  return (
    <aside className="border-border bg-background rounded-md border p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{definition.label}</h2>
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

      <div className="space-y-3">
        {selectedObject.geometry.kind === 'corridor' ||
        selectedObject.geometry.kind === 'path_corridor' ? (
          <div className="grid grid-cols-3 gap-2">
            <div>
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
            <div>
              <Label className="text-xs">Laenge</Label>
              <Input value={selectedObject.geometry.length.toFixed(1)} disabled />
            </div>
            <div>
              <Label className="text-xs">Flaeche</Label>
              <Input value={selectedObject.geometry.area.toFixed(1)} disabled />
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

        <div className="border-border mt-4 border-t pt-4">
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

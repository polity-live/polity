import {
  Armchair,
  Bike,
  CarFront,
  Flower2,
  Footprints,
  GitCompareArrows,
  Layers,
  ParkingSquare,
  Route,
  Shrub,
  Sprout,
  TreePine,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import type { StreetDesignComparisonMode, StreetDesignObjectType } from '../types';
import {
  streetDesignObjectRegistry,
  streetDesignObjectTypes,
} from '../logic/streetDesignObjectRegistry';

interface StreetDesignToolbarViewProps {
  selectedTool: StreetDesignObjectType;
  comparisonMode: StreetDesignComparisonMode;
  readOnly: boolean;
  onToolChange: (type: StreetDesignObjectType) => void;
  onComparisonModeChange: (mode: StreetDesignComparisonMode) => void;
}

const objectIcons = {
  tree: TreePine,
  bush: Shrub,
  bank: Armchair,
  grass_strip: Sprout,
  flower_bed: Flower2,
  parking_area: ParkingSquare,
  street: Route,
  car_lane: CarFront,
  bike_lane: Bike,
  sidewalk: Footprints,
} satisfies Record<StreetDesignObjectType, ComponentType<{ className?: string }>>;

const comparisonModes: {
  mode: StreetDesignComparisonMode;
  label: string;
}[] = [
  { mode: 'original', label: 'Original' },
  { mode: 'new_design', label: 'Neu' },
  { mode: 'overlay', label: 'Overlay' },
  { mode: 'split', label: 'Split' },
];

export function StreetDesignToolbarView({
  selectedTool,
  comparisonMode,
  readOnly,
  onToolChange,
  onComparisonModeChange,
}: StreetDesignToolbarViewProps) {
  return (
    <aside className="border-border bg-background flex h-full min-w-0 flex-col gap-4 rounded-md border p-3 shadow-sm">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Layers className="text-muted-foreground size-4" />
          Elemente
        </div>
        <div className="grid grid-cols-2 gap-2">
          {streetDesignObjectTypes.map((type: StreetDesignObjectType) => {
            const definition = streetDesignObjectRegistry[type];
            const Icon = objectIcons[type];
            const isSelected = selectedTool === type;

            return (
              <Button
                key={type}
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                className="h-16 flex-col gap-1 px-2 text-[11px] leading-tight"
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
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <GitCompareArrows className="text-muted-foreground size-4" />
          Vergleich
        </div>
        <div className="grid grid-cols-2 gap-2">
          {comparisonModes.map((item: any) => (
            <Button
              key={item.mode}
              type="button"
              variant={comparisonMode === item.mode ? 'default' : 'outline'}
              size="sm"
              className="h-9 px-2 text-xs"
              onClick={() => onComparisonModeChange(item.mode)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </aside>
  );
}

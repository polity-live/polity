import {
  Armchair,
  Bike,
  Building2,
  Camera,
  CarFront,
  Flower2,
  Footprints,
  GitCompareArrows,
  Highlighter,
  Layers,
  ParkingSquare,
  Route,
  Shrub,
  Sprout,
  TreePine,
  MousePointer2,
  Waves,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import type {
  StreetDesignComparisonMode,
  StreetDesignInteractionMode,
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
  comparisonMode: StreetDesignComparisonMode;
  osmLayerVisibility: StreetDesignOsmLayerVisibility;
  showStreetMarkings: boolean;
  readOnly: boolean;
  onToolChange: (type: StreetDesignObjectType) => void;
  onInteractionModeChange: (mode: StreetDesignInteractionMode) => void;
  onComparisonModeChange: (mode: StreetDesignComparisonMode) => void;
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
  interactionMode,
  comparisonMode,
  osmLayerVisibility,
  showStreetMarkings,
  readOnly,
  onToolChange,
  onInteractionModeChange,
  onComparisonModeChange,
  onOsmLayerVisibilityChange,
  onShowStreetMarkingsChange,
}: StreetDesignToolbarViewProps) {
  const layerToggles = [
    { layer: 'building', label: 'Importierte Gebaeude', icon: Building2 },
    { layer: 'road', label: 'Strassen', icon: Route },
    { layer: 'green', label: 'Gruen', icon: Sprout },
    { layer: 'water', label: 'Wasser', icon: Waves },
  ] satisfies {
    layer: keyof StreetDesignOsmLayerVisibility;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }[];

  return (
    <aside className="border-border bg-background flex h-full min-w-0 flex-col gap-4 rounded-md border p-3 shadow-sm">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Camera className="text-muted-foreground size-4" />
          Modus
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={interactionMode === 'place' ? 'default' : 'outline'}
            size="sm"
            className="h-10 gap-2 px-2 text-xs"
            disabled={readOnly}
            onClick={() => onInteractionModeChange('place')}
          >
            <MousePointer2 className="size-4" />
            Platzieren
          </Button>
          <Button
            type="button"
            variant={interactionMode === 'camera' ? 'default' : 'outline'}
            size="sm"
            className="h-10 gap-2 px-2 text-xs"
            onClick={() => onInteractionModeChange('camera')}
          >
            <Camera className="size-4" />
            Kamera
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Layers className="text-muted-foreground size-4" />
          Bestand
        </div>
        <div className="grid grid-cols-2 gap-2">
          {layerToggles.map(item => {
            const Icon = item.icon;
            const isVisible = osmLayerVisibility[item.layer];

            return (
              <Button
                key={item.layer}
                type="button"
                variant={isVisible ? 'default' : 'outline'}
                size="sm"
                className="h-10 gap-2 px-2 text-xs"
                title={`${item.label} ${isVisible ? 'ausblenden' : 'einblenden'}`}
                onClick={() => onOsmLayerVisibilityChange(item.layer, !isVisible)}
              >
                <Icon className="size-4" />
                {item.label}
              </Button>
            );
          })}
          <Button
            type="button"
            variant={showStreetMarkings ? 'default' : 'outline'}
            size="sm"
            className="col-span-2 h-10 gap-2 px-2 text-xs"
            title={showStreetMarkings ? 'Markierungen ausblenden' : 'Markierungen einblenden'}
            onClick={() => onShowStreetMarkingsChange(!showStreetMarkings)}
          >
            <Highlighter className="size-4" />
            Markierungen
          </Button>
        </div>
      </div>

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
          {comparisonModes.map(item => (
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

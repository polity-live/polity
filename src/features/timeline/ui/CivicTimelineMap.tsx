'use client';

import { featureThemeMarkup, featureThemeValue } from '@/features/shared/theme';
import { useEffect, useMemo, useState } from 'react';
import type { CivicTimelineItem } from '../logic/civicTimeline';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { MapPanelSkeleton } from '@/features/shared/ui/feedback';
import { CivicTimelineMapView } from './CivicTimelineMapView';

type ReactLeafletModule = typeof import('react-leaflet');
type LeafletModule = typeof import('leaflet');

interface CivicTimelineMapProps {
  items: CivicTimelineItem[];
  activeItemId?: string | null;
  onActiveItemChange?: (itemId: string | null) => void;
  onItemSelect?: (item: CivicTimelineItem) => void;
  loadModules?: CivicTimelineMapModuleLoader;
}

export type CivicTimelineMapModuleLoader = () => Promise<{
  reactLeafletModule: ReactLeafletModule;
  leafletModule: LeafletModule;
}>;

export async function loadCivicTimelineMapModules() {
  const [reactLeafletModule, leafletModule] = await Promise.all([
    import('react-leaflet'),
    import('leaflet'),
  ]);
  return { reactLeafletModule, leafletModule };
}

export function averageCenter(items: CivicTimelineItem[]): [number, number] {
  const mapItems = items.filter(
    (
      item
    ): item is CivicTimelineItem & { coordinates: NonNullable<CivicTimelineItem['coordinates']> } =>
      Boolean(item.coordinates)
  );
  if (mapItems.length === 0) {
    return [51.1657, 10.4515];
  }

  const totals = mapItems.reduce(
    (sum, item) => {
      const coordinates = item.coordinates;
      return {
        latitude: sum.latitude + coordinates.latitude,
        longitude: sum.longitude + coordinates.longitude,
      };
    },
    { latitude: 0, longitude: 0 }
  );

  return [totals.latitude / mapItems.length, totals.longitude / mapItems.length];
}

export function getMarkerColor(type: CivicTimelineItem['type']) {
  switch (type) {
    case 'vote':
    case 'election':
      return featureThemeValue('chartChartRendererDangerColor');
    case 'event':
    case 'agenda_item':
      return featureThemeValue('networkNetworkEdgeHelpersWarningColor');
    case 'amendment':
    case 'workflow':
      return featureThemeValue('chartChartRendererAccentColor');
    case 'group':
      return featureThemeValue('networkNetworkVisualHelpersSuccessColorAlpha');
    case 'statement':
    case 'blog':
      return featureThemeValue('chartChartRendererInfoColor');
    default:
      return featureThemeValue('networkAmendmentPathVisualizationNeutralColorBeta');
  }
}

function CivicTimelineMapMessageView({ message }: { message: string }) {
  return (
    <div className="bg-muted/20 text-muted-foreground flex h-72 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm lg:h-[calc(100dvh-12rem)]">
      {message}
    </div>
  );
}

export function CivicTimelineMap({
  items,
  activeItemId,
  onActiveItemChange,
  onItemSelect,
  loadModules = loadCivicTimelineMapModules,
}: CivicTimelineMapProps) {
  const [modules, setModules] = useState<{
    reactLeafletModule: ReactLeafletModule;
    leafletModule: LeafletModule;
  } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isActive = true;

    const performModuleLoad = async () => {
      try {
        const { reactLeafletModule: nextReactLeafletModule, leafletModule: nextLeafletModule } =
          await loadModules();

        if (!isActive) return;

        setModules({
          reactLeafletModule: nextReactLeafletModule,
          leafletModule: nextLeafletModule,
        });
      } catch {
        if (isActive) {
          setLoadFailed(true);
        }
      }
    };

    void performModuleLoad();

    return () => {
      isActive = false;
    };
  }, [loadModules]);

  const iconsByType = useMemo(() => {
    if (!modules) return new Map<string, import('leaflet').DivIcon>();

    const icons = new Map<string, import('leaflet').DivIcon>();
    for (const item of items) {
      if (icons.has(item.type)) continue;
      const color = getMarkerColor(item.type);
      icons.set(
        item.type,
        modules.leafletModule.divIcon({
          className: '',
          html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 6px rgba(15,23,42,.35);"></span>`,
          iconAnchor: [9, 9],
          iconSize: [18, 18],
        })
      );
    }
    return icons;
  }, [items, modules]);

  const activeIcon = useMemo(() => {
    if (!modules) return null;

    return modules.leafletModule.divIcon({
      className: '',
      html: featureThemeMarkup('timelineCivicTimelineMapMapMarkerMarkup'),
      iconAnchor: [12, 12],
      iconSize: [24, 24],
    });
  }, [modules]);

  if (items.length === 0) {
    return (
      <CivicTimelineMapMessageView
        message={translateText('generated.inline.1165_no_mapped_activity_yet_caf1290e')}
      />
    );
  }

  if (loadFailed) {
    return (
      <CivicTimelineMapMessageView
        message={translateText('common.locationPicker.unavailable', 'Map could not be loaded.')}
      />
    );
  }

  if (!modules) {
    return (
      <MapPanelSkeleton
        label={translateText('common.locationPicker.loading', 'Loading map...')}
        className="rounded-lg"
        heightClassName="h-72 lg:h-[calc(100dvh-12rem)]"
      />
    );
  }

  const activeItem = items.find(item => item.id === activeItemId) ?? null;

  return (
    <CivicTimelineMapView
      activeIcon={activeIcon as import('leaflet').DivIcon}
      activeItem={activeItem}
      activeItemId={activeItemId}
      center={averageCenter(items)}
      iconsByType={iconsByType}
      items={items}
      onActiveItemChange={onActiveItemChange}
      onItemSelect={onItemSelect}
      reactLeafletModule={modules.reactLeafletModule}
      zoom={items.length === 1 ? 10 : 6}
    />
  );
}

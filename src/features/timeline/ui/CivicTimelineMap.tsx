'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CivicTimelineItem } from '../logic/civicTimeline';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type ReactLeafletModule = typeof import('react-leaflet');
type LeafletModule = typeof import('leaflet');

interface CivicTimelineMapProps {
  items: CivicTimelineItem[];
  activeItemId?: string | null;
  onActiveItemChange?: (itemId: string | null) => void;
  onItemSelect?: (item: CivicTimelineItem) => void;
}

function averageCenter(items: CivicTimelineItem[]): [number, number] {
  const mapItems = items.filter(item => item.coordinates);
  if (mapItems.length === 0) {
    return [51.1657, 10.4515];
  }

  const totals = mapItems.reduce(
    (sum, item) => ({
      latitude: sum.latitude + (item.coordinates?.latitude ?? 0),
      longitude: sum.longitude + (item.coordinates?.longitude ?? 0),
    }),
    { latitude: 0, longitude: 0 }
  );

  return [totals.latitude / mapItems.length, totals.longitude / mapItems.length];
}

function getMarkerColor(type: CivicTimelineItem['type']) {
  switch (type) {
    case 'vote':
    case 'election':
      return '#dc2626';
    case 'event':
    case 'agenda_item':
      return '#d97706';
    case 'amendment':
    case 'workflow':
      return '#7c3aed';
    case 'group':
      return '#059669';
    case 'statement':
    case 'blog':
      return '#2563eb';
    default:
      return '#334155';
  }
}

export function CivicTimelineMap({
  items,
  activeItemId,
  onActiveItemChange,
  onItemSelect,
}: CivicTimelineMapProps) {
  const [reactLeafletModule, setReactLeafletModule] = useState<ReactLeafletModule | null>(null);
  const [leafletModule, setLeafletModule] = useState<LeafletModule | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadModules = async () => {
      try {
        const [nextReactLeafletModule, nextLeafletModule] = await Promise.all([
          import('react-leaflet'),
          import('leaflet'),
        ]);

        if (!isActive) return;

        setReactLeafletModule(nextReactLeafletModule);
        setLeafletModule(nextLeafletModule);
      } catch {
        if (isActive) {
          setLoadFailed(true);
        }
      }
    };

    void loadModules();

    return () => {
      isActive = false;
    };
  }, []);

  const iconsByType = useMemo(() => {
    if (!leafletModule) return new Map<string, import('leaflet').DivIcon>();

    const icons = new Map<string, import('leaflet').DivIcon>();
    for (const item of items) {
      if (icons.has(item.type)) continue;
      const color = getMarkerColor(item.type);
      icons.set(
        item.type,
        leafletModule.divIcon({
          className: '',
          html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #ffffff;box-shadow:0 10px 24px rgba(15,23,42,0.26);"></span>`,
          iconAnchor: [9, 9],
          iconSize: [18, 18],
        })
      );
    }
    return icons;
  }, [items, leafletModule]);

  const activeIcon = useMemo(() => {
    if (!leafletModule) return null;

    return leafletModule.divIcon({
      className: '',
      html: '<span style="display:block;width:24px;height:24px;border-radius:9999px;background:#111827;border:4px solid #fef3c7;box-shadow:0 14px 30px rgba(17,24,39,0.42);"></span>',
      iconAnchor: [12, 12],
      iconSize: [24, 24],
    });
  }, [leafletModule]);

  if (items.length === 0) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-72 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm lg:h-[calc(100dvh-12rem)]">
        {translateText('generated.inline.1165_no_mapped_activity_yet_caf1290e')}
      </div>
    );
  }

  if (loadFailed || !reactLeafletModule || !leafletModule || !activeIcon) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-72 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm lg:h-[calc(100dvh-12rem)]">
        {translateText('generated.inline.1166_map_is_loading_5299ec7c')}
      </div>
    );
  }

  const { MapContainer, Marker, TileLayer, Tooltip, useMap } = reactLeafletModule;
  const center = averageCenter(items);
  const zoom = items.length === 1 ? 10 : 6;

  function ActiveMarkerController({ active }: { active?: CivicTimelineItem | null }) {
    const map = useMap();

    useEffect(() => {
      if (!active?.coordinates) return;

      map.flyTo(
        [active.coordinates.latitude, active.coordinates.longitude],
        Math.max(map.getZoom(), 9),
        {
          animate: true,
          duration: 0.35,
        }
      );
    }, [active, map]);

    return null;
  }

  const activeItem = items.find(item => item.id === activeItemId) ?? null;

  return (
    <div
      className="bg-background overflow-hidden rounded-lg border shadow-sm"
      data-testid="civic-timeline-map"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-72 w-full lg:h-[calc(100dvh-12rem)]"
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <ActiveMarkerController active={activeItem} />
        {items.map(item => {
          if (!item.coordinates) return null;

          const isActive = item.id === activeItemId;
          const markerIcon = isActive ? activeIcon : iconsByType.get(item.type);
          if (!markerIcon) return null;

          return (
            <Marker
              key={item.id}
              position={[item.coordinates.latitude, item.coordinates.longitude]}
              icon={markerIcon}
              eventHandlers={{
                mouseover: () => onActiveItemChange?.(item.id),
                mouseout: () => onActiveItemChange?.(null),
                click: () => onItemSelect?.(item),
              }}
            >
              <Tooltip permanent={isActive} direction="top" offset={[0, -12]} opacity={1}>
                <div className="max-w-48">
                  <div className="text-xs font-semibold">{item.title}</div>
                  {item.locationLabel && (
                    <div className="text-[11px] text-slate-500">{item.locationLabel}</div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SupporterMapItem } from '@/features/amendments/logic/supporterDirectory';
import { SupporterDirectoryDetails } from '@/features/amendments/ui/SupporterDirectoryDetails';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type ReactLeafletModule = typeof import('react-leaflet');
type LocalLeafletModule = typeof import('leaflet');

interface SupporterLocalityMapProps {
  items: readonly SupporterMapItem[];
  activeGroupId?: string | null;
  onHoverChange?: (groupId: string | null) => void;
  onSelect?: (groupId: string) => void;
}

function averageCenter(items: readonly SupporterMapItem[]): [number, number] {
  if (items.length === 0) {
    return [51.1657, 10.4515];
  }

  const totals = items.reduce(
    (sum, item) => ({
      latitude: sum.latitude + item.latitude,
      longitude: sum.longitude + item.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return [totals.latitude / items.length, totals.longitude / items.length];
}

export function SupporterLocalityMap({
  items,
  activeGroupId = null,
  onHoverChange,
  onSelect,
}: SupporterLocalityMapProps) {
  const [reactLeafletModule, setReactLeafletModule] = useState<ReactLeafletModule | null>(null);
  const [leafletModule, setLeafletModule] = useState<LocalLeafletModule | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadModules = async () => {
      try {
        const [nextReactLeafletModule, nextLeafletModule] = await Promise.all([
          import('react-leaflet'),
          import('leaflet'),
        ]);

        if (!isActive) {
          return;
        }

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

  const markerIcon = useMemo(() => {
    if (!leafletModule) {
      return null;
    }

    return leafletModule.divIcon({
      className: '',
      html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#15803d;border:3px solid #ffffff;box-shadow:0 10px 24px rgba(21,128,61,0.35);"></span>',
      iconAnchor: [9, 9],
      iconSize: [18, 18],
    });
  }, [leafletModule]);

  const activeMarkerIcon = useMemo(() => {
    if (!leafletModule) {
      return null;
    }

    return leafletModule.divIcon({
      className: '',
      html: '<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#166534;border:3px solid #dcfce7;box-shadow:0 12px 28px rgba(22,101,52,0.45);"></span>',
      iconAnchor: [11, 11],
      iconSize: [22, 22],
    });
  }, [leafletModule]);

  if (items.length === 0) {
    return null;
  }

  if (loadFailed || !reactLeafletModule || !markerIcon || !activeMarkerIcon) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-80 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm">
        {translateText('generated.inline.0175_supporter_map_is_loading_3dbf4547')}
      </div>
    );
  }

  const { MapContainer, Marker, TileLayer, Tooltip } = reactLeafletModule;
  const center = averageCenter(items);
  const zoom = items.length === 1 ? 10 : 5;

  return (
    <div
      className="overflow-hidden rounded-xl border shadow-sm"
      data-testid="supporter-locality-map"
    >
      <MapContainer center={center} zoom={zoom} className="h-80 w-full" attributionControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {items.map(item => {
          const isActive = activeGroupId === item.groupId;

          return (
            <Marker
              key={item.groupId}
              position={[item.latitude, item.longitude]}
              icon={isActive ? activeMarkerIcon : markerIcon}
              eventHandlers={{
                mouseover: () => onHoverChange?.(item.groupId),
                mouseout: () => onHoverChange?.(null),
                click: () => onSelect?.(item.groupId),
              }}
            >
              {isActive ? (
                <Tooltip permanent direction="top" offset={[0, -12]} opacity={1}>
                  <SupporterDirectoryDetails item={item} />
                </Tooltip>
              ) : null}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

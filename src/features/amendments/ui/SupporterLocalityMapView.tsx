import type { DivIcon } from 'leaflet';
import type { ComponentType } from 'react';

import type { SupporterMapItem } from '@/features/amendments/logic/supporterDirectory';
import { SupporterDirectoryDetails } from '@/features/amendments/ui/SupporterDirectoryDetails';
import { hasGeoLocationGeometry } from '@/features/shared/logic/geoLocationShape';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { MapPanelSkeleton } from '@/features/shared/ui/feedback';

type ReactLeafletModule = typeof import('react-leaflet');

interface SupporterLocalityMapViewProps {
  items: readonly SupporterMapItem[];
  activeGroupId?: string | null;
  onHoverChange?: (groupId: string | null) => void;
  onSelect?: (groupId: string) => void;
  activeMarkerIcon: DivIcon | null;
  center: [number, number];
  GeoJSON?: ReactLeafletModule['GeoJSON'];
  loadFailed: boolean;
  MapViewportController?: ComponentType<{ bounds: any }>;
  markerIcon: DivIcon | null;
  reactLeafletModule: ReactLeafletModule | null;
  viewportBounds?: any;
  zoom: number;
}

export function SupporterLocalityMapView({
  items,
  activeGroupId = null,
  onHoverChange,
  onSelect,
  activeMarkerIcon,
  center,
  GeoJSON,
  loadFailed,
  MapViewportController,
  markerIcon,
  reactLeafletModule,
  viewportBounds,
  zoom,
}: SupporterLocalityMapViewProps) {
  if (items.length === 0) {
    return null;
  }

  if (loadFailed) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-80 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm">
        {translateText('common.locationPicker.unavailable', 'Map could not be loaded.')}
      </div>
    );
  }

  if (!reactLeafletModule || !markerIcon || !activeMarkerIcon) {
    return (
      <MapPanelSkeleton
        label={translateText('common.locationPicker.loading', 'Loading map...')}
        className="rounded-xl"
        heightClassName="h-80"
      />
    );
  }

  const { MapContainer, Marker, TileLayer, Tooltip } = reactLeafletModule;
  const areaStyle = {
    color: '#0f766e',
    fillColor: '#14b8a6',
    fillOpacity: 0.16,
    opacity: 0.82,
    weight: 2,
  };
  const activeAreaStyle = {
    color: '#0f766e',
    fillColor: '#0f766e',
    fillOpacity: 0.28,
    opacity: 0.95,
    weight: 3,
  };

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
        {MapViewportController ? <MapViewportController bounds={viewportBounds ?? null} /> : null}
        {items.map((item: any) => {
          const isActive = activeGroupId === item.groupId;
          const isArea = hasGeoLocationGeometry(item.locationShape);
          const eventHandlers = {
            mouseover: () => onHoverChange?.(item.groupId),
            mouseout: () => onHoverChange?.(null),
            click: () => onSelect?.(item.groupId),
          };

          if (isArea && GeoJSON) {
            return (
              <GeoJSON
                key={`${item.groupId}:${isActive ? 'active' : 'idle'}`}
                data={item.locationShape.geometry}
                style={isActive ? activeAreaStyle : areaStyle}
                eventHandlers={eventHandlers}
              >
                {isActive ? (
                  <Tooltip sticky direction="top" opacity={1}>
                    <SupporterDirectoryDetails item={item} />
                  </Tooltip>
                ) : null}
              </GeoJSON>
            );
          }

          return (
            <Marker
              key={item.groupId}
              position={[item.latitude, item.longitude]}
              icon={isActive ? activeMarkerIcon : markerIcon}
              eventHandlers={eventHandlers}
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

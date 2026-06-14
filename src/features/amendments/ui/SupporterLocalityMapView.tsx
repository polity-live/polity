import type { DivIcon } from 'leaflet';

import type { SupporterMapItem } from '@/features/amendments/logic/supporterDirectory';
import { SupporterDirectoryDetails } from '@/features/amendments/ui/SupporterDirectoryDetails';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type ReactLeafletModule = typeof import('react-leaflet');

interface SupporterLocalityMapViewProps {
  items: readonly SupporterMapItem[];
  activeGroupId?: string | null;
  onHoverChange?: (groupId: string | null) => void;
  onSelect?: (groupId: string) => void;
  activeMarkerIcon: DivIcon | null;
  center: [number, number];
  loadFailed: boolean;
  markerIcon: DivIcon | null;
  reactLeafletModule: ReactLeafletModule | null;
  zoom: number;
}

export function SupporterLocalityMapView({
  items,
  activeGroupId = null,
  onHoverChange,
  onSelect,
  activeMarkerIcon,
  center,
  loadFailed,
  markerIcon,
  reactLeafletModule,
  zoom,
}: SupporterLocalityMapViewProps) {
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

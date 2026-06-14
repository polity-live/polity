import { featureThemeClassName } from '@/features/shared/theme';
import type { CivicTimelineItem } from '../logic/civicTimeline';
import { CivicTimelineActiveMarkerContainer } from './CivicTimelineActiveMarkerContainer';

type ReactLeafletModule = typeof import('react-leaflet');

interface CivicTimelineMapViewProps {
  items: CivicTimelineItem[];
  activeItemId?: string | null;
  activeItem: CivicTimelineItem | null;
  onActiveItemChange?: (itemId: string | null) => void;
  onItemSelect?: (item: CivicTimelineItem) => void;
  reactLeafletModule: ReactLeafletModule;
  iconsByType: Map<string, import('leaflet').DivIcon>;
  activeIcon: import('leaflet').DivIcon;
  center: [number, number];
  zoom: number;
}

export function CivicTimelineMapView({
  items,
  activeItemId,
  activeItem,
  onActiveItemChange,
  onItemSelect,
  reactLeafletModule,
  iconsByType,
  activeIcon,
  center,
  zoom,
}: CivicTimelineMapViewProps) {
  const { MapContainer, Marker, TileLayer, Tooltip, useMap } = reactLeafletModule;

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
        <CivicTimelineActiveMarkerContainer active={activeItem} useMap={useMap} />
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
                    <div className={featureThemeClassName('timelineCivicTimelineMapNeutralText')}>
                      {item.locationLabel}
                    </div>
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

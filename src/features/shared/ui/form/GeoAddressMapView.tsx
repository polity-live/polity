import type { Marker as LeafletMarker } from 'leaflet';
import { MapPanelSkeleton } from '@/features/shared/ui/feedback';

export interface GeoAddressMapViewProps {
  coordinates: any;
  onCoordinatesChange: any;
  isBusy: any;
  loadingLabel: any;
  unavailableLabel: any;
  busyLabel: any;
  emptyMessage: any;
  moveHint: any;
  interactive: any;
  reactLeafletModule: any;
  setReactLeafletModule: any;
  leafletModule: any;
  setLeafletModule: any;
  loadFailed: any;
  setLoadFailed: any;
  markerIcon: any;
  position: any;
  zoom: any;
  MapContainer: any;
  Marker: any;
  TileLayer: any;
  useMap: any;
  useMapEvents: any;
  MapViewportController: any;
  MapClickHandler: any;
}

export function GeoAddressMapView({
  coordinates,
  onCoordinatesChange,
  isBusy,
  loadingLabel,
  unavailableLabel,
  busyLabel,
  emptyMessage,
  moveHint,
  interactive,
  reactLeafletModule,
  leafletModule,
  loadFailed,
  markerIcon,
  position,
  zoom,
  MapContainer,
  Marker,
  TileLayer,
  MapViewportController,
  MapClickHandler,
}: GeoAddressMapViewProps) {
  if (loadFailed) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-72 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm">
        {unavailableLabel}
      </div>
    );
  }

  if (!reactLeafletModule || !leafletModule || !markerIcon) {
    return <MapPanelSkeleton label={loadingLabel} className="rounded-xl" />;
  }

  return (
    <div className="bg-muted/20 overflow-hidden rounded-xl border shadow-sm" data-swipe-lock>
      <div className="relative h-72 w-full">
        <MapContainer
          center={position}
          zoom={zoom}
          className="h-full w-full"
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <MapViewportController center={position} zoomLevel={zoom} />
          {interactive ? <MapClickHandler onSelect={onCoordinatesChange} /> : null}
          {coordinates ? (
            <Marker
              position={position}
              draggable={interactive}
              icon={markerIcon}
              eventHandlers={
                interactive
                  ? {
                      dragend(event: any) {
                        const marker = event.target as LeafletMarker;
                        const nextPosition = marker.getLatLng();

                        onCoordinatesChange({
                          latitude: nextPosition.lat,
                          longitude: nextPosition.lng,
                        });
                      },
                    }
                  : undefined
              }
            />
          ) : null}
        </MapContainer>
        {isBusy ? (
          <div className="bg-background/60 absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
            <div className="bg-background text-foreground rounded-full border px-3 py-1 text-xs font-medium shadow-sm">
              {busyLabel}
            </div>
          </div>
        ) : null}
        <div className="bg-background/92 text-muted-foreground pointer-events-none absolute inset-x-3 bottom-3 rounded-lg border px-3 py-2 text-xs shadow-sm">
          {coordinates ? moveHint : emptyMessage}
        </div>
      </div>
    </div>
  );
}

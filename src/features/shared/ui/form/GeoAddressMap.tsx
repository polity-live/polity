import { useEffect, useMemo, useState } from 'react';
import type { Marker as LeafletMarker } from 'leaflet';
import type { GeoCoordinates } from '@/features/shared/logic/geoCoordinates';

interface GeoAddressMapProps {
  coordinates: GeoCoordinates | null;
  onCoordinatesChange: (coordinates: GeoCoordinates) => void;
  isBusy?: boolean;
  loadingLabel: string;
  busyLabel: string;
  emptyMessage: string;
  moveHint: string;
  interactive?: boolean;
}

type ReactLeafletModule = typeof import('react-leaflet');
type LeafletModule = typeof import('leaflet');

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;
const FILLED_ZOOM = 15;

export function GeoAddressMap({
  coordinates,
  onCoordinatesChange,
  isBusy = false,
  loadingLabel,
  busyLabel,
  emptyMessage,
  moveHint,
  interactive = true,
}: GeoAddressMapProps) {
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

    loadModules();

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
      html: '<span style="display:block;width:20px;height:20px;border-radius:9999px;background:#0f766e;border:3px solid #ffffff;box-shadow:0 10px 24px rgba(15,118,110,0.35);"></span>',
      iconAnchor: [10, 10],
      iconSize: [20, 20],
    });
  }, [leafletModule]);

  const position = coordinates
    ? ([coordinates.latitude, coordinates.longitude] as [number, number])
    : DEFAULT_CENTER;
  const zoom = coordinates ? FILLED_ZOOM : DEFAULT_ZOOM;

  if (loadFailed) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-72 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm">
        {loadingLabel}
      </div>
    );
  }

  if (!reactLeafletModule || !leafletModule || !markerIcon) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-72 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm">
        {loadingLabel}
      </div>
    );
  }

  const { MapContainer, Marker, TileLayer, useMap, useMapEvents } = reactLeafletModule;

  function MapViewportController({
    center,
    zoomLevel,
  }: {
    center: [number, number];
    zoomLevel: number;
  }) {
    const map = useMap();

    useEffect(() => {
      map.flyTo(center, zoomLevel, {
        animate: true,
        duration: 0.35,
      });
    }, [center, map, zoomLevel]);

    return null;
  }

  function MapClickHandler({ onSelect }: { onSelect: (nextCoordinates: GeoCoordinates) => void }) {
    useMapEvents({
      click(event) {
        onSelect({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        });
      },
    });

    return null;
  }

  return (
    <div className="bg-muted/20 overflow-hidden rounded-xl border shadow-sm">
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
                      dragend(event) {
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

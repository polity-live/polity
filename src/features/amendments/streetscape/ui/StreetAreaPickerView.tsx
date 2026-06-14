import { useEffect } from 'react';
import { MapPinned } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import type { StreetDesignGeoPoint } from '../types';
type ReactLeafletModule = typeof import('react-leaflet');
export interface StreetAreaPickerViewProps {
  center: any;
  bbox: any;
  isLoadingOsm: any;
  osmError: any;
  readOnly: any;
  onCenterChange: any;
  onLoadOsm: any;
  onLoadSample: any;
  reactLeafletModule: any;
  setReactLeafletModule: any;
  leafletModule: any;
  setLeafletModule: any;
  loadFailed: any;
  setLoadFailed: any;
  markerIcon: any;
  position: any;
  bounds: any;
  mapUnavailable: any;
}

export function StreetAreaPickerView({
  center,
  isLoadingOsm,
  osmError,
  readOnly,
  onCenterChange,
  onLoadOsm,
  onLoadSample,
  reactLeafletModule,
  markerIcon,
  position,
  bounds,
  mapUnavailable,
}: StreetAreaPickerViewProps) {
  return (
    <section className="border-border bg-background rounded-md border p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPinned className="text-muted-foreground size-4" />
          <div>
            <h2 className="text-sm font-semibold">Kartenausschnitt</h2>
            <p className="text-muted-foreground text-xs">
              {center.lat.toFixed(5)}, {center.lon.toFixed(5)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onLoadSample} disabled={readOnly}>
            Muster
          </Button>
          <Button size="sm" onClick={onLoadOsm} disabled={readOnly || isLoadingOsm}>
            {isLoadingOsm ? 'Laedt...' : 'OSM laden'}
          </Button>
        </div>
      </div>

      {mapUnavailable ? (
        <div className="bg-muted/20 text-muted-foreground flex h-48 items-center justify-center rounded-md border border-dashed text-sm">
          Karte konnte nicht geladen werden.
        </div>
      ) : (
        <div className="h-48 overflow-hidden rounded-md border">
          <reactLeafletModule.MapContainer
            center={position}
            zoom={17}
            className="h-full w-full"
            attributionControl={false}
          >
            <reactLeafletModule.TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <MapViewport center={position} reactLeafletModule={reactLeafletModule} />
            <MapClickHandler
              disabled={readOnly}
              reactLeafletModule={reactLeafletModule}
              onCenterChange={onCenterChange}
            />
            {bounds ? (
              <reactLeafletModule.Rectangle
                bounds={bounds}
                pathOptions={{ color: '#0f766e', weight: 2, fillOpacity: 0.08 }}
              />
            ) : null}
            <reactLeafletModule.Marker position={position} icon={markerIcon} />
          </reactLeafletModule.MapContainer>
        </div>
      )}

      {osmError ? <p className="text-destructive mt-2 text-xs">{osmError}</p> : null}
    </section>
  );
}

function MapViewport({
  center,
  reactLeafletModule,
}: {
  center: [number, number];
  reactLeafletModule: ReactLeafletModule;
}) {
  const map = reactLeafletModule.useMap();

  useEffect(() => {
    map.flyTo(center, 17, { animate: true, duration: 0.25 });
  }, [center, map]);

  return null;
}

function MapClickHandler({
  disabled,
  reactLeafletModule,
  onCenterChange,
}: {
  disabled: boolean;
  reactLeafletModule: ReactLeafletModule;
  onCenterChange: (center: StreetDesignGeoPoint) => void;
}) {
  reactLeafletModule.useMapEvents({
    click(event) {
      if (disabled) return;
      onCenterChange({ lat: event.latlng.lat, lon: event.latlng.lng });
    },
  });

  return null;
}

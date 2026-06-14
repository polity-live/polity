import { useEffect } from 'react';
import { MapPinned } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import type { StreetDesignGeoPoint, StreetDesignMapSelection } from '../types';
import type { StreetDesignBboxResizeHandle } from '../logic/streetDesignBbox';
type ReactLeafletModule = typeof import('react-leaflet');
export interface StreetAreaPickerViewProps {
  center: any;
  bbox: any;
  mapSelection: StreetDesignMapSelection;
  isLoadingOsm: any;
  osmError: any;
  readOnly: any;
  onMapSelectionChange: any;
  onLoadOsm: any;
  onLoadSample: any;
  reactLeafletModule: any;
  setReactLeafletModule: any;
  leafletModule: any;
  setLeafletModule: any;
  loadFailed: any;
  setLoadFailed: any;
  markerIcon: any;
  resizeMarkerIcon: any;
  rotateMarkerIcon: any;
  position: any;
  bounds: any;
  selectionCorners: [number, number][];
  rotateHandlePosition: [number, number];
  resizeHandles: { handle: StreetDesignBboxResizeHandle; position: [number, number] }[];
  widthMeters: number;
  heightMeters: number;
  rotationDeg: number;
  onBboxMove: (center: StreetDesignGeoPoint) => void;
  onBboxResize: (handle: StreetDesignBboxResizeHandle, point: StreetDesignGeoPoint) => void;
  onSelectionRotate: (point: StreetDesignGeoPoint) => void;
  onWidthMetersChange: (widthMeters: number) => void;
  onHeightMetersChange: (heightMeters: number) => void;
  onRotationDegreesChange: (rotationDeg: number) => void;
  mapUnavailable: any;
}

export function StreetAreaPickerView({
  center,
  isLoadingOsm,
  osmError,
  readOnly,
  onLoadOsm,
  onLoadSample,
  reactLeafletModule,
  markerIcon,
  resizeMarkerIcon,
  rotateMarkerIcon,
  position,
  bounds,
  selectionCorners,
  rotateHandlePosition,
  resizeHandles,
  widthMeters,
  heightMeters,
  rotationDeg,
  onBboxMove,
  onBboxResize,
  onSelectionRotate,
  onWidthMetersChange,
  onHeightMetersChange,
  onRotationDegreesChange,
  mapUnavailable,
}: StreetAreaPickerViewProps) {
  const updateWidth = (value: number) => {
    if (Number.isFinite(value)) onWidthMetersChange(value);
  };

  const updateHeight = (value: number) => {
    if (Number.isFinite(value)) onHeightMetersChange(value);
  };

  const updateRotation = (value: number) => {
    if (Number.isFinite(value)) onRotationDegreesChange(value);
  };

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
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-24 space-y-1">
            <Label className="text-muted-foreground text-[11px]">Breite m</Label>
            <Input
              type="number"
              min={20}
              step={10}
              value={widthMeters}
              disabled={readOnly}
              onChange={event => updateWidth(Number(event.target.value))}
            />
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-muted-foreground text-[11px]">Hoehe m</Label>
            <Input
              type="number"
              min={20}
              step={10}
              value={heightMeters}
              disabled={readOnly}
              onChange={event => updateHeight(Number(event.target.value))}
            />
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-muted-foreground text-[11px]">Drehung °</Label>
            <Input
              type="number"
              step={5}
              value={rotationDeg}
              disabled={readOnly}
              onChange={event => updateRotation(Number(event.target.value))}
            />
          </div>
          <Button size="sm" variant="outline" onClick={onLoadSample} disabled={readOnly}>
            Demo laden
          </Button>
          <Button size="sm" onClick={onLoadOsm} disabled={readOnly || isLoadingOsm}>
            {isLoadingOsm ? 'Laedt...' : 'OSM laden'}
          </Button>
        </div>
      </div>

      {mapUnavailable ? (
        <div className="bg-muted/20 text-muted-foreground flex h-96 items-center justify-center rounded-md border border-dashed text-sm">
          Karte konnte nicht geladen werden.
        </div>
      ) : (
        <div className="h-96 overflow-hidden rounded-md border">
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
            <MapViewport
              center={position}
              bounds={bounds}
              reactLeafletModule={reactLeafletModule}
            />
            <MapClickHandler
              disabled={readOnly}
              reactLeafletModule={reactLeafletModule}
              onBboxMove={onBboxMove}
            />
            {selectionCorners.length >= 3 ? (
              <reactLeafletModule.Polygon
                positions={selectionCorners}
                pathOptions={{ color: '#0f766e', weight: 2, fillOpacity: 0.08 }}
              />
            ) : null}
            <reactLeafletModule.Marker
              position={position}
              icon={markerIcon}
              draggable={!readOnly}
              eventHandlers={{
                drag(event: any) {
                  const latLng = event.target.getLatLng();
                  onBboxMove({ lat: latLng.lat, lon: latLng.lng });
                },
              }}
            />
            {resizeHandles.map(item => (
              <reactLeafletModule.Marker
                key={item.handle}
                position={item.position}
                icon={resizeMarkerIcon}
                draggable={!readOnly}
                title={`Ausschnitt ${item.handle} ziehen`}
                eventHandlers={{
                  drag(event: any) {
                    const latLng = event.target.getLatLng();
                    onBboxResize(item.handle, { lat: latLng.lat, lon: latLng.lng });
                  },
                }}
              />
            ))}
            <reactLeafletModule.Marker
              position={rotateHandlePosition}
              icon={rotateMarkerIcon}
              draggable={!readOnly}
              title="Ausschnitt drehen"
              eventHandlers={{
                drag(event: any) {
                  const latLng = event.target.getLatLng();
                  onSelectionRotate({ lat: latLng.lat, lon: latLng.lng });
                },
              }}
            />
          </reactLeafletModule.MapContainer>
        </div>
      )}

      {osmError ? <p className="text-destructive mt-2 text-xs">{osmError}</p> : null}
    </section>
  );
}

function MapViewport({
  center,
  bounds,
  reactLeafletModule,
}: {
  center: [number, number];
  bounds: any;
  reactLeafletModule: ReactLeafletModule;
}) {
  const map = reactLeafletModule.useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { animate: true, duration: 0.25, padding: [18, 18], maxZoom: 18 });
      return;
    }

    map.flyTo(center, 17, { animate: true, duration: 0.25 });
  }, [bounds, center, map]);

  return null;
}

function MapClickHandler({
  disabled,
  reactLeafletModule,
  onBboxMove,
}: {
  disabled: boolean;
  reactLeafletModule: ReactLeafletModule;
  onBboxMove: (center: StreetDesignGeoPoint) => void;
}) {
  reactLeafletModule.useMapEvents({
    click(event) {
      if (disabled) return;
      onBboxMove({ lat: event.latlng.lat, lon: event.latlng.lng });
    },
  });

  return null;
}

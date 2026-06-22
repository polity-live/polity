import type { DivIcon, LatLngBounds } from 'leaflet';
import { MapPinned } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { StreetDesignGeoPoint } from '../types';
import type { StreetDesignBboxResizeHandle } from '../logic/streetDesignBbox';
import {
  StreetAreaPickerMapViewport,
  StreetAreaPickerSelectionOverlay,
  type LeafletPosition,
  type ReactLeafletModule,
} from './StreetAreaPickerMapController';

export interface StreetAreaPickerViewProps {
  center: StreetDesignGeoPoint;
  isLoadingOsm: boolean;
  osmError: string | null;
  readOnly: boolean;
  onLoadOsm: () => void;
  onLoadSample: () => void;
  reactLeafletModule: ReactLeafletModule | null;
  markerIcon: DivIcon | null;
  resizeMarkerIcon: DivIcon | null;
  rotateMarkerIcon: DivIcon | null;
  position: LeafletPosition;
  bounds: LatLngBounds | null;
  selectionCorners: LeafletPosition[];
  rotateHandlePosition: LeafletPosition;
  resizeHandles: { handle: StreetDesignBboxResizeHandle; position: LeafletPosition }[];
  widthMeters: number;
  heightMeters: number;
  rotationDeg: number;
  onBboxMove: (center: StreetDesignGeoPoint) => void;
  onBboxResize: (handle: StreetDesignBboxResizeHandle, point: StreetDesignGeoPoint) => void;
  onSelectionRotate: (point: StreetDesignGeoPoint) => void;
  onWidthMetersChange: (widthMeters: number) => void;
  onHeightMetersChange: (heightMeters: number) => void;
  onRotationDegreesChange: (rotationDeg: number) => void;
  mapUnavailable: boolean;
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
  const { t } = useTranslation();
  const updateWidth = (value: number) => {
    if (Number.isFinite(value)) onWidthMetersChange(value);
  };

  const updateHeight = (value: number) => {
    if (Number.isFinite(value)) onHeightMetersChange(value);
  };

  const updateRotation = (value: number) => {
    if (Number.isFinite(value)) onRotationDegreesChange(value);
  };

  const mapReady =
    !mapUnavailable &&
    reactLeafletModule != null &&
    markerIcon != null &&
    resizeMarkerIcon != null &&
    rotateMarkerIcon != null;

  return (
    <section className="bg-card overflow-hidden rounded-lg border shadow-sm" data-swipe-lock>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-muted/40 flex size-9 items-center justify-center rounded-md border">
            <MapPinned className="text-muted-foreground size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">
              {t('features.amendments.streetscape.areaPicker.title')}
            </h2>
            <p className="text-muted-foreground text-xs">
              {center.lat.toFixed(5)}, {center.lon.toFixed(5)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-24 space-y-1">
            <Label className="text-muted-foreground text-[11px]">
              {t('features.amendments.streetscape.areaPicker.widthMeters')}
            </Label>
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
            <Label className="text-muted-foreground text-[11px]">
              {t('features.amendments.streetscape.areaPicker.heightMeters')}
            </Label>
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
            <Label className="text-muted-foreground text-[11px]">
              {t('features.amendments.streetscape.areaPicker.rotationDegrees')}
            </Label>
            <Input
              type="number"
              step={5}
              value={rotationDeg}
              disabled={readOnly}
              onChange={event => updateRotation(Number(event.target.value))}
            />
          </div>
          <Button size="sm" variant="outline" onClick={onLoadSample} disabled={readOnly}>
            {t('features.amendments.streetscape.areaPicker.loadDemo')}
          </Button>
          <Button size="sm" onClick={onLoadOsm} disabled={readOnly || isLoadingOsm}>
            {isLoadingOsm
              ? t('features.amendments.streetscape.areaPicker.loadingOsm')
              : t('features.amendments.streetscape.areaPicker.loadOsm')}
          </Button>
        </div>
      </div>

      <div className="p-3">
        {!mapReady ? (
          <div className="bg-muted/20 text-muted-foreground flex h-64 items-center justify-center rounded-md border border-dashed text-sm">
            {t('features.amendments.streetscape.areaPicker.mapUnavailable')}
          </div>
        ) : (
          <div className="h-64 overflow-hidden rounded-md border md:h-72">
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
              <StreetAreaPickerMapViewport
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
              <StreetAreaPickerSelectionOverlay
                readOnly={readOnly}
                reactLeafletModule={reactLeafletModule}
                markerIcon={markerIcon}
                resizeMarkerIcon={resizeMarkerIcon}
                rotateMarkerIcon={rotateMarkerIcon}
                position={position}
                rotateHandlePosition={rotateHandlePosition}
                resizeHandles={resizeHandles}
                onBboxMove={onBboxMove}
                onBboxResize={onBboxResize}
                onSelectionRotate={onSelectionRotate}
              />
            </reactLeafletModule.MapContainer>
          </div>
        )}
      </div>

      {osmError ? <p className="text-destructive px-4 pb-3 text-xs">{osmError}</p> : null}
    </section>
  );
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

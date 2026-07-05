import type { DivIcon, LatLngBounds } from 'leaflet';
import { ChevronDown, MapPinned, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { MapPanelSkeleton } from '@/features/shared/ui/feedback';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import {
  GeoAddressFields,
  type GeoAddressTextMap,
} from '@/features/shared/ui/form/GeoAddressFields';
import type {
  GeoAddressField,
  GeoAddressValues,
  GeoResolvedAddress,
} from '@/features/shared/ui/form/GeoAddressInputField';
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'card' | 'panel';
  locationSearchValues: GeoAddressValues;
  locationSearchLabels: GeoAddressTextMap;
  locationSearchPlaceholders: GeoAddressTextMap;
  locationSearchResetKey: number;
  mapViewportFocusKey: number;
  onLocationSearchFieldChange: (field: GeoAddressField, value: string) => void;
  onLocationSearchResolved: (result: GeoResolvedAddress | null) => void;
  onLocationSearchReset: () => void;
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
  mapLoading: boolean;
  mapUnavailable: boolean;
}

export function StreetAreaPickerView({
  center,
  isLoadingOsm,
  osmError,
  readOnly,
  onLoadOsm,
  onLoadSample,
  open,
  onOpenChange,
  variant = 'card',
  locationSearchValues,
  locationSearchLabels,
  locationSearchPlaceholders,
  locationSearchResetKey,
  mapViewportFocusKey,
  onLocationSearchFieldChange,
  onLocationSearchResolved,
  onLocationSearchReset,
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
  mapLoading,
  mapUnavailable,
}: StreetAreaPickerViewProps) {
  const { t } = useTranslation();
  const [internalMapSectionOpen, setInternalMapSectionOpen] = useState(true);
  const mapSectionOpen = open ?? internalMapSectionOpen;
  const setMapSectionOpen = onOpenChange ?? setInternalMapSectionOpen;
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

  const mapSectionTitle = t('features.amendments.streetscape.areaPicker.title');

  return (
    <Collapsible open={mapSectionOpen} onOpenChange={setMapSectionOpen}>
      <section
        className={cn(
          'bg-card overflow-hidden border shadow-sm',
          variant === 'panel'
            ? 'bg-background rounded-none border-x-0 border-t shadow-none'
            : 'rounded-lg'
        )}
        data-swipe-lock
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-w-0 justify-start px-2 py-1"
              aria-label={mapSectionTitle}
            >
              <span className="bg-muted/40 flex size-9 shrink-0 items-center justify-center rounded-md border">
                <MapPinned className="text-muted-foreground size-4" />
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold">{mapSectionTitle}</span>
                <span className="text-muted-foreground block text-xs">
                  {center.lat.toFixed(5)}, {center.lon.toFixed(5)}
                </span>
              </span>
              <ChevronDown
                className={`text-muted-foreground size-4 shrink-0 transition-transform ${
                  mapSectionOpen ? 'rotate-180' : ''
                }`}
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="border-b px-4 py-3">
            <div className="flex flex-wrap items-end justify-end gap-2">
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

          <div className="border-b px-4 py-3">
            <div className="bg-muted/20 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Search className="text-muted-foreground size-4 shrink-0" />
                  <h3 className="truncate text-sm font-medium">
                    {t('features.amendments.streetscape.areaPicker.locationSearchTitle')}
                  </h3>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={readOnly}
                  title={t('features.amendments.streetscape.areaPicker.clearSearch')}
                  aria-label={t('features.amendments.streetscape.areaPicker.clearSearch')}
                  onClick={onLocationSearchReset}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="pt-3">
                <GeoAddressFields
                  idPrefix="street-design-location-search"
                  values={locationSearchValues}
                  onFieldChange={onLocationSearchFieldChange}
                  labels={locationSearchLabels}
                  placeholders={locationSearchPlaceholders}
                  onResolvedAddress={onLocationSearchResolved}
                  resetContextKey={locationSearchResetKey}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          <div className="p-3">
            {mapLoading ? (
              <MapPanelSkeleton
                label={t('features.amendments.streetscape.areaPicker.loadingMap')}
                heightClassName="h-64 md:h-72"
              />
            ) : !mapReady ? (
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
                    focusKey={mapViewportFocusKey}
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
                    markerIcon={markerIcon as DivIcon}
                    resizeMarkerIcon={resizeMarkerIcon as DivIcon}
                    rotateMarkerIcon={rotateMarkerIcon as DivIcon}
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

            {osmError ? <p className="text-destructive mt-2 text-sm">{osmError}</p> : null}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
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

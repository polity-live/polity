import { useEffect, useMemo, useState } from 'react';
import type { GeoCoordinates } from '@/features/shared/logic/geoCoordinates';
import {
  hasGeoLocationBounds,
  hasGeoLocationGeometry,
  type GeoLocationBounds,
  type GeoLocationShape,
} from '@/features/shared/logic/geoLocationShape';
interface GeoAddressMapProps {
  coordinates: GeoCoordinates | null;
  onCoordinatesChange: (coordinates: GeoCoordinates) => void;
  shape?: GeoLocationShape | null;
  isBusy?: boolean;
  loadingLabel: string;
  unavailableLabel: string;
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
const AREA_ZOOM = 10;

function centerFromBounds(bounds: GeoLocationBounds): [number, number] {
  return [(bounds.south + bounds.north) / 2, (bounds.west + bounds.east) / 2];
}

export function useGeoAddressMapController({
  coordinates,
  onCoordinatesChange,
  shape = null,
  isBusy = false,
  loadingLabel,
  unavailableLabel,
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

  const hasAreaGeometry = hasGeoLocationGeometry(shape);
  const viewportBounds = hasGeoLocationBounds(shape) ? shape.bounds : null;
  const shapeKey = shape
    ? [
        shape.kind,
        shape.placeId ?? '',
        viewportBounds?.south ?? '',
        viewportBounds?.west ?? '',
        viewportBounds?.north ?? '',
        viewportBounds?.east ?? '',
      ].join(':')
    : null;

  const position = viewportBounds
    ? centerFromBounds(viewportBounds)
    : coordinates
      ? ([coordinates.latitude, coordinates.longitude] as [number, number])
      : DEFAULT_CENTER;

  const zoom = viewportBounds ? AREA_ZOOM : coordinates ? FILLED_ZOOM : DEFAULT_ZOOM;
  const areaStyle = {
    color: '#0f766e',
    fillColor: '#14b8a6',
    fillOpacity: 0.18,
    opacity: 0.85,
    weight: 2,
  };

  const GeoJSON =
    reactLeafletModule && 'GeoJSON' in reactLeafletModule ? reactLeafletModule.GeoJSON : undefined;
  const { MapContainer, Marker, TileLayer, useMap, useMapEvents } =
    reactLeafletModule ?? ({} as ReactLeafletModule);

  function MapViewportController({
    center,
    zoomLevel,
    bounds,
  }: {
    center: [number, number];
    zoomLevel: number;
    bounds: GeoLocationBounds | null;
  }) {
    const map = useMap();

    useEffect(() => {
      if (bounds) {
        map.fitBounds(
          [
            [bounds.south, bounds.west],
            [bounds.north, bounds.east],
          ],
          {
            animate: true,
            duration: 0.35,
            padding: [16, 16],
          }
        );
        return;
      }

      map.flyTo(center, zoomLevel, {
        animate: true,
        duration: 0.35,
      });
    }, [bounds, center, map, zoomLevel]);

    return null;
  }

  function MapClickHandler({ onSelect }: { onSelect: (nextCoordinates: GeoCoordinates) => void }) {
    useMapEvents({
      click(event: any) {
        onSelect({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        });
      },
    });

    return null;
  }

  return {
    coordinates,
    onCoordinatesChange,
    shape,
    isBusy,
    loadingLabel,
    unavailableLabel,
    busyLabel,
    emptyMessage,
    moveHint,
    interactive,
    reactLeafletModule,
    setReactLeafletModule,
    leafletModule,
    setLeafletModule,
    loadFailed,
    setLoadFailed,
    markerIcon,
    hasAreaGeometry,
    viewportBounds,
    shapeKey,
    areaStyle,
    position,
    zoom,
    GeoJSON,
    MapContainer,
    Marker,
    TileLayer,
    useMap,
    useMapEvents,
    MapViewportController,
    MapClickHandler,
  };
}

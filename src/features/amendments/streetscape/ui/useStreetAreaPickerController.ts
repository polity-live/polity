import { useEffect, useMemo, useState } from 'react';
import type { DivIcon } from 'leaflet';
import type { StreetDesignBoundingBox, StreetDesignGeoPoint } from '../types';
interface StreetAreaPickerProps {
  center: StreetDesignGeoPoint;
  bbox: StreetDesignBoundingBox;
  isLoadingOsm: boolean;
  osmError: string | null;
  readOnly: boolean;
  onCenterChange: (center: StreetDesignGeoPoint) => void;
  onLoadOsm: () => void;
  onLoadSample: () => void;
}
type ReactLeafletModule = typeof import('react-leaflet');
type LeafletModule = typeof import('leaflet');

export function useStreetAreaPickerController({
  center,
  bbox,
  isLoadingOsm,
  osmError,
  readOnly,
  onCenterChange,
  onLoadOsm,
  onLoadSample,
}: StreetAreaPickerProps) {
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

        if (!isActive) return;
        setReactLeafletModule(nextReactLeafletModule);
        setLeafletModule(nextLeafletModule);
      } catch {
        if (isActive) setLoadFailed(true);
      }
    };

    void loadModules();

    return () => {
      isActive = false;
    };
  }, []);

  const markerIcon = useMemo<DivIcon | null>(() => {
    if (!leafletModule) return null;

    return leafletModule.divIcon({
      className: '',
      html: '<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#0f766e;border:3px solid white;box-shadow:0 10px 24px rgba(15,118,110,0.35);"></span>',
      iconAnchor: [11, 11],
      iconSize: [22, 22],
    });
  }, [leafletModule]);

  const position = [center.lat, center.lon] as [number, number];

  const bounds =
    leafletModule != null
      ? leafletModule.latLngBounds([bbox.south, bbox.west], [bbox.north, bbox.east])
      : null;

  const mapUnavailable = loadFailed || !reactLeafletModule || !leafletModule || !markerIcon;

  return {
    center,
    bbox,
    isLoadingOsm,
    osmError,
    readOnly,
    onCenterChange,
    onLoadOsm,
    onLoadSample,
    reactLeafletModule,
    setReactLeafletModule,
    leafletModule,
    setLeafletModule,
    loadFailed,
    setLoadFailed,
    markerIcon,
    position,
    bounds,
    mapUnavailable,
  };
}

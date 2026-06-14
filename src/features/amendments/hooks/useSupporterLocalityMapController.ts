import { useEffect, useMemo, useState } from 'react';

import { featureThemeMarkup } from '@/features/shared/theme';

import type { SupporterMapItem } from '../logic/supporterDirectory';

type ReactLeafletModule = typeof import('react-leaflet');
type LocalLeafletModule = typeof import('leaflet');

function averageCenter(items: readonly SupporterMapItem[]): [number, number] {
  if (items.length === 0) {
    return [51.1657, 10.4515];
  }

  const totals = items.reduce(
    (sum, item) => ({
      latitude: sum.latitude + item.latitude,
      longitude: sum.longitude + item.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return [totals.latitude / items.length, totals.longitude / items.length];
}

export function useSupporterLocalityMapController(items: readonly SupporterMapItem[]) {
  const [reactLeafletModule, setReactLeafletModule] = useState<ReactLeafletModule | null>(null);
  const [leafletModule, setLeafletModule] = useState<LocalLeafletModule | null>(null);
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

    void loadModules();

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
      html: featureThemeMarkup('amendmentSupporterLocalityMapMapMarkerMarkup'),
      iconAnchor: [9, 9],
      iconSize: [18, 18],
    });
  }, [leafletModule]);

  const activeMarkerIcon = useMemo(() => {
    if (!leafletModule) {
      return null;
    }

    return leafletModule.divIcon({
      className: '',
      html: featureThemeMarkup('amendmentSupporterLocalityMapMapMarkerMarkupAlpha'),
      iconAnchor: [11, 11],
      iconSize: [22, 22],
    });
  }, [leafletModule]);

  return {
    activeMarkerIcon,
    center: averageCenter(items),
    loadFailed,
    markerIcon,
    reactLeafletModule,
    zoom: items.length === 1 ? 10 : 5,
  };
}

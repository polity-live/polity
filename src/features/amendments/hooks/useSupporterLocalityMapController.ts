import { useEffect, useMemo, useState } from 'react';

import { featureThemeMarkup } from '@/features/shared/theme';
import {
  hasGeoLocationBounds,
  type GeoLocationBounds,
} from '@/features/shared/logic/geoLocationShape';

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

function extendBounds(bounds: GeoLocationBounds | null, item: SupporterMapItem): GeoLocationBounds {
  const itemBounds = hasGeoLocationBounds(item.locationShape)
    ? item.locationShape.bounds
    : {
        south: item.latitude,
        west: item.longitude,
        north: item.latitude,
        east: item.longitude,
      };

  if (!bounds) {
    return itemBounds;
  }

  return {
    south: Math.min(bounds.south, itemBounds.south),
    west: Math.min(bounds.west, itemBounds.west),
    north: Math.max(bounds.north, itemBounds.north),
    east: Math.max(bounds.east, itemBounds.east),
  };
}

function getViewportBounds(items: readonly SupporterMapItem[]): GeoLocationBounds | null {
  return items.reduce<GeoLocationBounds | null>((bounds, item) => extendBounds(bounds, item), null);
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

  const viewportBounds = useMemo(() => getViewportBounds(items), [items]);
  const GeoJSON =
    reactLeafletModule && 'GeoJSON' in reactLeafletModule ? reactLeafletModule.GeoJSON : undefined;
  const useMap =
    reactLeafletModule && 'useMap' in reactLeafletModule ? reactLeafletModule.useMap : undefined;

  function MapViewportController({ bounds }: { bounds: GeoLocationBounds | null }) {
    if (!useMap) {
      return null;
    }

    const map = useMap();

    useEffect(() => {
      if (!bounds) {
        return;
      }

      map.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        {
          animate: false,
          padding: [18, 18],
        }
      );
    }, [bounds, map]);

    return null;
  }

  return {
    activeMarkerIcon,
    center: averageCenter(items),
    GeoJSON,
    loadFailed,
    MapViewportController,
    markerIcon,
    reactLeafletModule,
    viewportBounds,
    zoom: items.length === 1 ? 10 : 5,
  };
}

export const supporterLocalityMapControllerInternals = {
  averageCenter,
  extendBounds,
  getViewportBounds,
};

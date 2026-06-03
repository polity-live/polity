'use client';

import { useEffect, useMemo, useState } from 'react';

type ReactLeafletModule = typeof import('react-leaflet');
type LocalLeafletModule = typeof import('leaflet');

export interface SupporterMapItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  groupHref: string;
  decisionHref: string;
}

interface SupporterLocalityMapProps {
  items: readonly SupporterMapItem[];
}

function averageCenter(items: readonly SupporterMapItem[]): [number, number] {
  if (items.length === 0) {
    return [51.1657, 10.4515];
  }

  const total = items.reduce(
    (sum, item) => ({
      latitude: sum.latitude + item.latitude,
      longitude: sum.longitude + item.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return [total.latitude / items.length, total.longitude / items.length];
}

export function SupporterLocalityMap({ items }: SupporterLocalityMapProps) {
  const [reactLeafletModule, setReactLeafletModule] = useState<ReactLeafletModule | null>(null);
  const [leafletModule, setLeafletModule] = useState<LocalLeafletModule | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadModules = async () => {
      const [nextReactLeafletModule, nextLeafletModule] = await Promise.all([
        import('react-leaflet'),
        import('leaflet'),
      ]);

      if (!isActive) {
        return;
      }

      setReactLeafletModule(nextReactLeafletModule);
      setLeafletModule(nextLeafletModule);
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
      html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#15803d;border:3px solid #ffffff;box-shadow:0 10px 24px rgba(21,128,61,0.35);"></span>',
      iconAnchor: [9, 9],
      iconSize: [18, 18],
    });
  }, [leafletModule]);

  if (items.length === 0) {
    return null;
  }

  if (!reactLeafletModule || !markerIcon) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-80 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm">
        Unterstützerkarte wird geladen.
      </div>
    );
  }

  const { MapContainer, Marker, Popup, TileLayer } = reactLeafletModule;
  const center = averageCenter(items);
  const zoom = items.length === 1 ? 10 : 5;

  return (
    <div className="overflow-hidden rounded-xl border shadow-sm">
      <MapContainer center={center} zoom={zoom} className="h-80 w-full" attributionControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {items.map(item => (
          <Marker key={item.id} position={[item.latitude, item.longitude]} icon={markerIcon}>
            <Popup>
              <div className="space-y-2">
                <p className="font-medium">{item.name}</p>
                <div className="flex flex-col gap-1 text-sm">
                  <a className="text-primary underline" href={item.groupHref}>
                    Gruppe öffnen
                  </a>
                  <a className="text-primary underline" href={item.decisionHref}>
                    Entscheidung öffnen
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

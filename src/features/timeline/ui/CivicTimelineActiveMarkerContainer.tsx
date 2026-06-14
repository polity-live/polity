import { useEffect } from 'react';
import type { CivicTimelineItem } from '../logic/civicTimeline';

type ReactLeafletModule = typeof import('react-leaflet');

function CivicTimelineActiveMarkerView() {
  return null;
}

export function CivicTimelineActiveMarkerContainer({
  active,
  useMap,
}: {
  active?: CivicTimelineItem | null;
  useMap: ReactLeafletModule['useMap'];
}) {
  const map = useMap();

  useEffect(() => {
    if (!active?.coordinates) return;

    map.flyTo(
      [active.coordinates.latitude, active.coordinates.longitude],
      Math.max(map.getZoom(), 9),
      {
        animate: true,
        duration: 0.35,
      }
    );
  }, [active, map]);

  return <CivicTimelineActiveMarkerView />;
}

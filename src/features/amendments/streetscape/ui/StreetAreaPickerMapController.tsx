import { useEffect, useRef } from 'react';
import type { DivIcon, LatLngBounds, LeafletEventHandlerFnMap } from 'leaflet';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { StreetDesignGeoPoint } from '../types';
import type { StreetDesignBboxResizeHandle } from '../logic/streetDesignBbox';

export type ReactLeafletModule = typeof import('react-leaflet');
export type LeafletPosition = [number, number];

interface MapGestureHandler {
  enabled?: () => boolean;
  disable?: () => void;
  enable?: () => void;
}

interface MapWithSelectionGestures {
  dragging?: MapGestureHandler;
  touchZoom?: MapGestureHandler;
}

interface LeafletOriginalEvent {
  stopPropagation?: () => void;
}

interface LeafletGestureEvent {
  originalEvent?: LeafletOriginalEvent;
}

interface LeafletMarkerDragEvent extends LeafletGestureEvent {
  target: {
    getLatLng: () => {
      lat: number;
      lng: number;
    };
  };
}

export function StreetAreaPickerMapViewport({
  center,
  bounds,
  reactLeafletModule,
}: {
  center: LeafletPosition;
  bounds: LatLngBounds | null;
  reactLeafletModule: ReactLeafletModule;
}) {
  const map = reactLeafletModule.useMap();
  const initialBoundsRef = useRef(bounds);
  const initialCenterRef = useRef(center);

  useEffect(() => {
    if (initialBoundsRef.current) {
      map.fitBounds(initialBoundsRef.current, {
        animate: false,
        padding: [18, 18],
        maxZoom: 18,
      });
      return;
    }

    map.flyTo(initialCenterRef.current, 17, { animate: false });
  }, [map]);

  return null;
}

export function StreetAreaPickerSelectionOverlay({
  readOnly,
  reactLeafletModule,
  markerIcon,
  resizeMarkerIcon,
  rotateMarkerIcon,
  position,
  rotateHandlePosition,
  resizeHandles,
  onBboxMove,
  onBboxResize,
  onSelectionRotate,
}: {
  readOnly: boolean;
  reactLeafletModule: ReactLeafletModule;
  markerIcon: DivIcon;
  resizeMarkerIcon: DivIcon;
  rotateMarkerIcon: DivIcon;
  position: LeafletPosition;
  rotateHandlePosition: LeafletPosition;
  resizeHandles: { handle: StreetDesignBboxResizeHandle; position: LeafletPosition }[];
  onBboxMove: (center: StreetDesignGeoPoint) => void;
  onBboxResize: (handle: StreetDesignBboxResizeHandle, point: StreetDesignGeoPoint) => void;
  onSelectionRotate: (point: StreetDesignGeoPoint) => void;
}) {
  const { t } = useTranslation();
  const map = reactLeafletModule.useMap() as MapWithSelectionGestures;
  const restoreMapGesturesRef = useRef<(() => void) | null>(null);

  const beginSelectionDrag = (event: LeafletGestureEvent) => {
    stopLeafletGestureEvent(event);
    restoreMapGesturesRef.current?.();
    restoreMapGesturesRef.current = disableMapSelectionConflictingGestures(map);
  };

  const endSelectionDrag = (event: LeafletGestureEvent) => {
    stopLeafletGestureEvent(event);
    restoreMapGesturesRef.current?.();
    restoreMapGesturesRef.current = null;
  };

  const guardSelectionGesture = (event: LeafletGestureEvent) => {
    stopLeafletGestureEvent(event);
  };

  useEffect(
    () => () => {
      restoreMapGesturesRef.current?.();
      restoreMapGesturesRef.current = null;
    },
    []
  );

  const createMarkerEventHandlers = (
    onDrag: (event: LeafletMarkerDragEvent) => void
  ): LeafletEventHandlerFnMap =>
    ({
      mousedown: guardSelectionGesture,
      pointerdown: guardSelectionGesture,
      touchstart: guardSelectionGesture,
      dragstart: beginSelectionDrag,
      drag: onDrag,
      dragend: endSelectionDrag,
    }) as unknown as LeafletEventHandlerFnMap;

  return (
    <>
      <reactLeafletModule.Marker
        position={position}
        icon={markerIcon}
        draggable={!readOnly}
        eventHandlers={createMarkerEventHandlers(event => {
          const latLng = event.target.getLatLng();
          onBboxMove({ lat: latLng.lat, lon: latLng.lng });
        })}
      />
      {resizeHandles.map(item => (
        <reactLeafletModule.Marker
          key={item.handle}
          position={item.position}
          icon={resizeMarkerIcon}
          draggable={!readOnly}
          title={t('features.amendments.streetscape.map.resizeHandleTitle', {
            handle: item.handle,
          })}
          eventHandlers={createMarkerEventHandlers(event => {
            const latLng = event.target.getLatLng();
            onBboxResize(item.handle, { lat: latLng.lat, lon: latLng.lng });
          })}
        />
      ))}
      <reactLeafletModule.Marker
        position={rotateHandlePosition}
        icon={rotateMarkerIcon}
        draggable={!readOnly}
        title={t('features.amendments.streetscape.map.rotateHandleTitle')}
        eventHandlers={createMarkerEventHandlers(event => {
          const latLng = event.target.getLatLng();
          onSelectionRotate({ lat: latLng.lat, lon: latLng.lng });
        })}
      />
    </>
  );
}

function stopLeafletGestureEvent(event: LeafletGestureEvent) {
  event.originalEvent?.stopPropagation?.();
}

function disableMapSelectionConflictingGestures(map: MapWithSelectionGestures) {
  const handlers = [map.dragging, map.touchZoom].filter(isMapGestureHandler).map(handler => ({
    handler,
    wasEnabled: typeof handler.enabled === 'function' ? handler.enabled() : true,
  }));

  handlers.forEach(({ handler }) => handler.disable?.());

  return () => {
    handlers.forEach(({ handler, wasEnabled }) => {
      if (wasEnabled) {
        handler.enable?.();
      } else {
        handler.disable?.();
      }
    });
  };
}

function isMapGestureHandler(handler: MapGestureHandler | undefined): handler is MapGestureHandler {
  return handler != null;
}

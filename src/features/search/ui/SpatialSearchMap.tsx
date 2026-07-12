'use client';

import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { featureThemeMarkup, featureThemeValue } from '@/features/shared/theme';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { MapPanelSkeleton } from '@/features/shared/ui/feedback';
import { type SearchBounds, type SearchSpatialItem } from '../logic/searchSpatial';

type ReactLeafletModule = typeof import('react-leaflet');
type LeafletModule = typeof import('leaflet');
type LeafletDivIcon = import('leaflet').DivIcon;

interface SpatialSearchMapProps {
  items: SearchSpatialItem[];
  activeItem: SearchSpatialItem | null;
  activeDocumentId?: string | null;
  center: [number, number];
  onBoundsChange: (bounds: SearchBounds) => void;
  onActiveDocumentChange?: (documentId: string | null) => void;
  onItemSelect: (documentId: string) => void;
}

interface MarkerClusterGroupProps {
  children: ReactNode;
  chunkedLoading?: boolean;
  iconCreateFunction?: (cluster: { getChildCount: () => number }) => LeafletDivIcon;
  maxClusterRadius?: number;
  showCoverageOnHover?: boolean;
  spiderfyDistanceMultiplier?: number;
  spiderfyOnEveryZoom?: boolean;
  spiderfyOnMaxZoom?: boolean;
  spiderLegPolylineOptions?: {
    color: string;
    opacity: number;
    weight: number;
  };
  zoomToBoundsOnClick?: boolean;
}

interface LeafletMouseEventLike {
  originalEvent?: Event;
}

function getMarkerColor(type: string) {
  switch (type) {
    case 'vote':
    case 'election':
      return featureThemeValue('chartChartRendererDangerColor');
    case 'event':
    case 'agenda_item':
      return featureThemeValue('networkNetworkEdgeHelpersWarningColor');
    case 'amendment':
    case 'workflow':
    case 'todo':
      return featureThemeValue('chartChartRendererAccentColor');
    case 'group':
      return featureThemeValue('networkNetworkVisualHelpersSuccessColorAlpha');
    case 'statement':
    case 'blog':
    case 'user':
      return featureThemeValue('chartChartRendererInfoColor');
    default:
      return featureThemeValue('networkAmendmentPathVisualizationNeutralColorBeta');
  }
}

function clusterCountLabel(count: number) {
  return count > 99 ? '99+' : String(count);
}

function createClusterIcon(leafletModule: LeafletModule, cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  const size = count > 99 ? 44 : count > 9 ? 40 : 34;

  return leafletModule.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border:2px solid white;box-shadow:0 2px 10px rgba(15,23,42,.35);font-size:12px;font-weight:700;">${clusterCountLabel(count)}</span>`,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size],
  });
}

function SpatialSearchMapMessageView({ message }: { message: string }) {
  return (
    <div className="bg-muted/20 text-muted-foreground flex h-72 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm lg:h-full lg:min-h-0">
      {message}
    </div>
  );
}

function toSearchBounds(bounds: {
  getNorth: () => number;
  getSouth: () => number;
  getEast: () => number;
  getWest: () => number;
}): SearchBounds {
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}

function SpatialSearchBoundsReporter({
  useMap,
  useMapEvents,
  onBoundsChange,
}: {
  useMap: ReactLeafletModule['useMap'];
  useMapEvents: ReactLeafletModule['useMapEvents'];
  onBoundsChange: (bounds: SearchBounds) => void;
}) {
  const map = useMap();
  const timerRef = useRef<number | null>(null);

  const reportBounds = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      onBoundsChange(toSearchBounds(map.getBounds()));
    }, 180);
  }, [map, onBoundsChange]);

  useEffect(() => {
    reportBounds();

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [reportBounds]);

  useMapEvents({
    moveend: reportBounds,
    zoomend: reportBounds,
  });

  return null;
}

function SpatialSearchActiveMarkerContainer({
  active,
  useMap,
}: {
  active: SearchSpatialItem | null;
  useMap: ReactLeafletModule['useMap'];
}) {
  const map = useMap();

  useEffect(() => {
    if (!active) return;

    map.flyTo(
      [active.coordinates.latitude, active.coordinates.longitude],
      Math.max(map.getZoom(), 9),
      {
        animate: true,
        duration: 0.35,
      }
    );
  }, [active, map]);

  return null;
}

function SpatialSearchMarkers({
  items,
  activeDocumentId,
  reactLeafletModule,
  MarkerClusterGroup,
  leafletModule,
  iconsByType,
  activeIcon,
  onActiveDocumentChange,
  onItemSelect,
}: {
  items: SearchSpatialItem[];
  activeDocumentId?: string | null;
  reactLeafletModule: ReactLeafletModule;
  MarkerClusterGroup: ComponentType<MarkerClusterGroupProps>;
  leafletModule: LeafletModule;
  iconsByType: Map<string, LeafletDivIcon>;
  activeIcon: LeafletDivIcon;
  onActiveDocumentChange?: (documentId: string | null) => void;
  onItemSelect: (documentId: string) => void;
}) {
  const { Marker, Tooltip } = reactLeafletModule;
  const iconCreateFunction = useCallback(
    (cluster: { getChildCount: () => number }) => createClusterIcon(leafletModule, cluster),
    [leafletModule]
  );
  const spiderLegPolylineOptions = useMemo(
    () => ({
      color: featureThemeValue('networkAmendmentPathVisualizationNeutralColorBeta'),
      opacity: 0.55,
      weight: 1,
    }),
    []
  );

  return (
    <MarkerClusterGroup
      chunkedLoading
      iconCreateFunction={iconCreateFunction}
      maxClusterRadius={44}
      showCoverageOnHover={false}
      spiderfyDistanceMultiplier={1.15}
      spiderfyOnEveryZoom={false}
      spiderfyOnMaxZoom
      spiderLegPolylineOptions={spiderLegPolylineOptions}
      zoomToBoundsOnClick
    >
      {items.map(item => {
        const isActive = item.id === activeDocumentId;
        const markerIcon = isActive ? activeIcon : iconsByType.get(item.type);
        if (!markerIcon) return null;

        return (
          <Marker
            key={item.id}
            position={[item.coordinates.latitude, item.coordinates.longitude]}
            icon={markerIcon}
            bubblingMouseEvents={false}
            eventHandlers={{
              click: (event?: LeafletMouseEventLike) => {
                if (event?.originalEvent) {
                  leafletModule.DomEvent.stopPropagation(event.originalEvent);
                }
                onActiveDocumentChange?.(item.id);
                onItemSelect(item.id);
              },
            }}
          >
            <Tooltip permanent={isActive} direction="top" offset={[0, -12]} opacity={1}>
              <div className="max-w-48">
                <div className="text-xs font-semibold">{item.title}</div>
                {item.locationLabel ? (
                  <div className="text-muted-foreground text-[11px]">{item.locationLabel}</div>
                ) : null}
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}

export function SpatialSearchMap({
  items,
  activeItem,
  activeDocumentId,
  center,
  onBoundsChange,
  onActiveDocumentChange,
  onItemSelect,
}: SpatialSearchMapProps) {
  const [reactLeafletModule, setReactLeafletModule] = useState<ReactLeafletModule | null>(null);
  const [leafletModule, setLeafletModule] = useState<LeafletModule | null>(null);
  const [MarkerClusterGroup, setMarkerClusterGroup] =
    useState<ComponentType<MarkerClusterGroupProps> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadModules = async () => {
      try {
        const [nextReactLeafletModule, nextLeafletModule, nextMarkerClusterModule] =
          await Promise.all([
            import('react-leaflet'),
            import('leaflet'),
            import('react-leaflet-cluster'),
          ]);

        if (!isActive) return;

        setReactLeafletModule(nextReactLeafletModule);
        setLeafletModule(nextLeafletModule);
        setMarkerClusterGroup(
          () => nextMarkerClusterModule.default as ComponentType<MarkerClusterGroupProps>
        );
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

  const iconsByType = useMemo(() => {
    if (!leafletModule) return new Map<string, import('leaflet').DivIcon>();

    const icons = new Map<string, import('leaflet').DivIcon>();
    for (const item of items) {
      if (icons.has(item.type)) continue;
      const color = getMarkerColor(item.type);
      icons.set(
        item.type,
        leafletModule.divIcon({
          className: '',
          html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 6px rgba(15,23,42,.35);"></span>`,
          iconAnchor: [9, 9],
          iconSize: [18, 18],
        })
      );
    }
    return icons;
  }, [items, leafletModule]);

  const activeIcon = useMemo(() => {
    if (!leafletModule) return null;

    return leafletModule.divIcon({
      className: '',
      html: featureThemeMarkup('timelineCivicTimelineMapMapMarkerMarkup'),
      iconAnchor: [12, 12],
      iconSize: [24, 24],
    });
  }, [leafletModule]);

  if (loadFailed) {
    return (
      <SpatialSearchMapMessageView
        message={translateText('common.locationPicker.unavailable', 'Map could not be loaded.')}
      />
    );
  }

  if (!reactLeafletModule || !leafletModule || !MarkerClusterGroup || !activeIcon) {
    return (
      <MapPanelSkeleton
        label={translateText('common.locationPicker.loading', 'Loading map...')}
        className="rounded-lg"
        heightClassName="h-72 lg:h-full lg:min-h-0"
      />
    );
  }

  const { MapContainer, TileLayer, useMap, useMapEvents } = reactLeafletModule;

  return (
    <div
      className="bg-background overflow-hidden rounded-lg border shadow-sm lg:h-full lg:min-h-0"
      data-testid="spatial-search-map"
      data-swipe-lock
    >
      <MapContainer
        center={center}
        zoom={items.length === 1 ? 10 : 6}
        className="h-72 w-full lg:h-full lg:min-h-0"
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <SpatialSearchBoundsReporter
          useMap={useMap}
          useMapEvents={useMapEvents}
          onBoundsChange={onBoundsChange}
        />
        <SpatialSearchActiveMarkerContainer active={activeItem} useMap={useMap} />
        <SpatialSearchMarkers
          items={items}
          activeDocumentId={activeDocumentId}
          reactLeafletModule={reactLeafletModule}
          MarkerClusterGroup={MarkerClusterGroup}
          leafletModule={leafletModule}
          iconsByType={iconsByType}
          activeIcon={activeIcon}
          onActiveDocumentChange={onActiveDocumentChange}
          onItemSelect={onItemSelect}
        />
      </MapContainer>
    </div>
  );
}

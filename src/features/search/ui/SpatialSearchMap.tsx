'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  featureThemeClassName,
  featureThemeMarkup,
  featureThemeValue,
} from '@/features/shared/theme';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  getSpiderfyOffsets,
  spatialCoordinateKey,
  type SearchBounds,
  type SearchSpatialItem,
  type SpatialCoordinates,
} from '../logic/searchSpatial';

type ReactLeafletModule = typeof import('react-leaflet');
type LeafletModule = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type LeafletDivIcon = import('leaflet').DivIcon;

const CLUSTER_RADIUS_PX = 36;
const CLUSTER_MAX_ZOOM = 17;

interface SpatialSearchMapProps {
  items: SearchSpatialItem[];
  activeItem: SearchSpatialItem | null;
  activeDocumentId?: string | null;
  center: [number, number];
  onBoundsChange: (bounds: SearchBounds) => void;
  onActiveDocumentChange?: (documentId: string | null) => void;
  onItemSelect: (documentId: string) => void;
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

interface SpatialMarkerCluster {
  id: string;
  items: SearchSpatialItem[];
  coordinates: SpatialCoordinates;
  isExactStack: boolean;
}

interface SpatialSpiderfiedItem {
  item: SearchSpatialItem;
  coordinates: SpatialCoordinates;
}

function clusterCountLabel(count: number) {
  return count > 99 ? '99+' : String(count);
}

function createClusterIcon(leafletModule: LeafletModule, count: number) {
  const size = count > 99 ? 44 : count > 9 ? 40 : 34;

  return leafletModule.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border:2px solid white;box-shadow:0 2px 10px rgba(15,23,42,.35);font-size:12px;font-weight:700;">${clusterCountLabel(count)}</span>`,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size],
  });
}

function squaredDistance(left: { x: number; y: number }, right: { x: number; y: number }) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function buildMarkerClusters(items: SearchSpatialItem[], map: LeafletMap): SpatialMarkerCluster[] {
  const zoom = map.getZoom();
  const clusters: {
    items: SearchSpatialItem[];
    point: { x: number; y: number };
  }[] = [];
  const radiusSquared = CLUSTER_RADIUS_PX * CLUSTER_RADIUS_PX;

  for (const item of items) {
    const point = map.project([item.coordinates.latitude, item.coordinates.longitude], zoom);
    let nearestCluster:
      | {
          items: SearchSpatialItem[];
          point: { x: number; y: number };
        }
      | undefined;

    for (const cluster of clusters) {
      if (squaredDistance(cluster.point, point) <= radiusSquared) {
        nearestCluster = cluster;
        break;
      }
    }

    if (!nearestCluster) {
      clusters.push({
        items: [item],
        point: { x: point.x, y: point.y },
      });
      continue;
    }

    const nextCount = nearestCluster.items.length + 1;
    nearestCluster.point = {
      x: (nearestCluster.point.x * nearestCluster.items.length + point.x) / nextCount,
      y: (nearestCluster.point.y * nearestCluster.items.length + point.y) / nextCount,
    };
    nearestCluster.items.push(item);
  }

  return clusters.map(cluster => {
    const keys = new Set(cluster.items.map(item => spatialCoordinateKey(item.coordinates)));
    const isExactStack = keys.size === 1;
    const center = isExactStack
      ? cluster.items[0].coordinates
      : (() => {
          const latLng = map.unproject([cluster.point.x, cluster.point.y], zoom);
          return { latitude: latLng.lat, longitude: latLng.lng };
        })();

    return {
      id: cluster.items.map(item => item.id).join('|'),
      items: cluster.items,
      coordinates: center,
      isExactStack,
    };
  });
}

function getSpiderfiedItems(
  cluster: SpatialMarkerCluster,
  map: LeafletMap
): SpatialSpiderfiedItem[] {
  const zoom = map.getZoom();
  const centerPoint = map.project(
    [cluster.coordinates.latitude, cluster.coordinates.longitude],
    zoom
  );
  const offsets = getSpiderfyOffsets(cluster.items.length);

  return cluster.items.map((item, index) => {
    const offset = offsets[index] ?? { x: 0, y: 0 };
    const latLng = map.unproject([centerPoint.x + offset.x, centerPoint.y + offset.y], zoom);

    return {
      item,
      coordinates: {
        latitude: latLng.lat,
        longitude: latLng.lng,
      },
    };
  });
}

function SpatialSearchMapMessageView({ message }: { message: string }) {
  return (
    <div className="bg-muted/20 text-muted-foreground flex h-72 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm lg:h-[calc(100dvh-15rem)] lg:min-h-[520px]">
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
  leafletModule,
  iconsByType,
  activeIcon,
  onActiveDocumentChange,
  onItemSelect,
}: {
  items: SearchSpatialItem[];
  activeDocumentId?: string | null;
  reactLeafletModule: ReactLeafletModule;
  leafletModule: LeafletModule;
  iconsByType: Map<string, LeafletDivIcon>;
  activeIcon: LeafletDivIcon;
  onActiveDocumentChange?: (documentId: string | null) => void;
  onItemSelect: (documentId: string) => void;
}) {
  const { Marker, Polyline, Tooltip, useMap, useMapEvents } = reactLeafletModule;
  const map = useMap();
  const [mapRevision, setMapRevision] = useState(0);
  const [spiderfiedClusterId, setSpiderfiedClusterId] = useState<string | null>(null);

  const refreshClusters = useCallback(() => {
    setMapRevision(revision => revision + 1);
  }, []);

  useMapEvents({
    moveend: refreshClusters,
    zoomend: () => {
      setSpiderfiedClusterId(null);
      refreshClusters();
    },
  });

  const clusters = useMemo(() => buildMarkerClusters(items, map), [items, map, mapRevision]);
  const clusterIcons = useMemo(() => {
    const icons = new Map<number, LeafletDivIcon>();
    for (const cluster of clusters) {
      if (cluster.items.length <= 1 || icons.has(cluster.items.length)) continue;
      icons.set(cluster.items.length, createClusterIcon(leafletModule, cluster.items.length));
    }
    return icons;
  }, [clusters, leafletModule]);

  useEffect(() => {
    if (!activeDocumentId) return;

    const activeCluster = clusters.find(
      cluster =>
        cluster.items.length > 1 && cluster.items.some(item => item.id === activeDocumentId)
    );

    if (activeCluster) {
      setSpiderfiedClusterId(activeCluster.id);
    }
  }, [activeDocumentId, clusters]);

  const spiderfiedCluster = clusters.find(cluster => cluster.id === spiderfiedClusterId) ?? null;
  const spiderfiedItems = spiderfiedCluster ? getSpiderfiedItems(spiderfiedCluster, map) : [];
  const spiderfiedItemIds = new Set(spiderfiedItems.map(({ item }) => item.id));

  const handleClusterClick = useCallback(
    (cluster: SpatialMarkerCluster) => {
      onActiveDocumentChange?.(cluster.items[0]?.id ?? null);

      if (cluster.isExactStack || map.getZoom() >= CLUSTER_MAX_ZOOM) {
        setSpiderfiedClusterId(currentId => (currentId === cluster.id ? null : cluster.id));
        return;
      }

      const bounds = leafletModule.latLngBounds(
        cluster.items.map(
          item => [item.coordinates.latitude, item.coordinates.longitude] as [number, number]
        )
      );

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.25), {
          animate: true,
          maxZoom: CLUSTER_MAX_ZOOM,
        });
      } else {
        setSpiderfiedClusterId(cluster.id);
      }
    },
    [leafletModule, map, onActiveDocumentChange]
  );

  const renderItemMarker = (
    item: SearchSpatialItem,
    coordinates: SpatialCoordinates = item.coordinates
  ) => {
    const isActive = item.id === activeDocumentId;
    const markerIcon = isActive ? activeIcon : iconsByType.get(item.type);
    if (!markerIcon) return null;

    return (
      <Marker
        key={coordinates === item.coordinates ? item.id : `spider-${item.id}`}
        position={[coordinates.latitude, coordinates.longitude]}
        icon={markerIcon}
        eventHandlers={{
          mouseover: () => onActiveDocumentChange?.(item.id),
          click: () => onItemSelect(item.id),
        }}
      >
        <Tooltip permanent={isActive} direction="top" offset={[0, -12]} opacity={1}>
          <div className="max-w-48">
            <div className="text-xs font-semibold">{item.title}</div>
            {item.locationLabel ? (
              <div className={featureThemeClassName('timelineCivicTimelineMapNeutralText')}>
                {item.locationLabel}
              </div>
            ) : null}
          </div>
        </Tooltip>
      </Marker>
    );
  };

  return (
    <>
      {clusters.map(cluster => {
        if (cluster.items.length === 1) {
          const item = cluster.items[0];
          return spiderfiedItemIds.has(item.id) ? null : renderItemMarker(item);
        }

        if (cluster.id === spiderfiedClusterId) return null;

        const clusterIcon = clusterIcons.get(cluster.items.length);
        if (!clusterIcon) return null;

        return (
          <Marker
            key={cluster.id}
            position={[cluster.coordinates.latitude, cluster.coordinates.longitude]}
            icon={clusterIcon}
            eventHandlers={{
              click: () => handleClusterClick(cluster),
            }}
          >
            <Tooltip direction="top" offset={[0, -18]} opacity={1}>
              <div className="max-w-48">
                <div className="text-xs font-semibold">
                  {cluster.items.length} {translateText('features.search.results', 'results')}
                </div>
                <div className={featureThemeClassName('timelineCivicTimelineMapNeutralText')}>
                  {cluster.isExactStack
                    ? translateText('features.search.sameLocation', 'Same location')
                    : translateText('features.search.nearbyLocations', 'Nearby locations')}
                </div>
              </div>
            </Tooltip>
          </Marker>
        );
      })}

      {spiderfiedCluster
        ? spiderfiedItems.map(({ item, coordinates }) => (
            <Polyline
              key={`line-${item.id}`}
              positions={[
                [spiderfiedCluster.coordinates.latitude, spiderfiedCluster.coordinates.longitude],
                [coordinates.latitude, coordinates.longitude],
              ]}
              pathOptions={{
                color: featureThemeValue('networkAmendmentPathVisualizationNeutralColorBeta'),
                opacity: 0.55,
                weight: 1,
              }}
            />
          ))
        : null}

      {spiderfiedItems.map(({ item, coordinates }) => renderItemMarker(item, coordinates))}
    </>
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

  if (loadFailed || !reactLeafletModule || !leafletModule || !activeIcon) {
    return (
      <SpatialSearchMapMessageView
        message={translateText('generated.inline.1166_map_is_loading_5299ec7c')}
      />
    );
  }

  const { MapContainer, TileLayer, useMap, useMapEvents } = reactLeafletModule;

  return (
    <div
      className="bg-background overflow-hidden rounded-lg border shadow-sm"
      data-testid="spatial-search-map"
    >
      <MapContainer
        center={center}
        zoom={items.length === 1 ? 10 : 6}
        className="h-72 w-full lg:h-[calc(100dvh-15rem)] lg:min-h-[520px]"
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

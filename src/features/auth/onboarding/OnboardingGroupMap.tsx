'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DivIcon } from 'leaflet';

import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import {
  featureThemeClassName,
  featureThemeMarkup,
  featureThemeValue,
} from '@/features/shared/theme';
import type { Group } from '../hooks/useOnboarding.ts';

type ReactLeafletModule = typeof import('react-leaflet');
type LeafletModule = typeof import('leaflet');

interface OnboardingGroupMapProps {
  groups: Group[];
  activeGroupId?: string | null;
  selectedGroupIds: Set<string>;
  onActiveGroupChange?: (groupId: string | null) => void;
}

interface OnboardingGroupMapViewProps extends OnboardingGroupMapProps {
  activeGroup: Group | null;
  activeIcon: DivIcon;
  center: [number, number];
  defaultIcon: DivIcon;
  reactLeafletModule: ReactLeafletModule;
  selectedIcon: DivIcon;
  zoom: number;
}

function hasCoordinates(group: Group): group is Group & { latitude: number; longitude: number } {
  return (
    typeof group.latitude === 'number' &&
    Number.isFinite(group.latitude) &&
    typeof group.longitude === 'number' &&
    Number.isFinite(group.longitude)
  );
}

function averageCenter(groups: Group[]): [number, number] {
  const mappableGroups = groups.filter(hasCoordinates);

  if (mappableGroups.length === 0) {
    return [51.1657, 10.4515];
  }

  const totals = mappableGroups.reduce(
    (sum, group) => ({
      latitude: sum.latitude + group.latitude,
      longitude: sum.longitude + group.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return [totals.latitude / mappableGroups.length, totals.longitude / mappableGroups.length];
}

function OnboardingGroupMapMessage({ message }: { message: string }) {
  return (
    <div className="bg-muted/20 text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm sm:h-72 lg:h-[24rem]">
      {message}
    </div>
  );
}

function ActiveGroupFlyTo({
  activeGroup,
  useMap,
}: {
  activeGroup: Group | null;
  useMap: ReactLeafletModule['useMap'];
}) {
  const map = useMap();

  useEffect(() => {
    if (!activeGroup || !hasCoordinates(activeGroup)) return;

    map.flyTo([activeGroup.latitude, activeGroup.longitude], Math.max(map.getZoom(), 9), {
      animate: true,
      duration: 0.35,
    });
  }, [activeGroup, map]);

  return null;
}

function OnboardingGroupMapView({
  groups,
  activeGroup,
  activeGroupId,
  activeIcon,
  center,
  defaultIcon,
  onActiveGroupChange,
  reactLeafletModule,
  selectedGroupIds,
  selectedIcon,
  zoom,
}: OnboardingGroupMapViewProps) {
  const { MapContainer, Marker, TileLayer, Tooltip, useMap } = reactLeafletModule;

  return (
    <div
      className="bg-background overflow-hidden rounded-lg border shadow-sm"
      data-testid="onboarding-group-map"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-64 w-full sm:h-72 lg:h-[24rem]"
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <ActiveGroupFlyTo activeGroup={activeGroup} useMap={useMap} />
        {groups.map(group => {
          if (!hasCoordinates(group)) return null;

          const isActive = group.id === activeGroupId;
          const isSelected = selectedGroupIds.has(group.id);
          const markerIcon = isActive ? activeIcon : isSelected ? selectedIcon : defaultIcon;

          return (
            <Marker
              key={group.id}
              position={[group.latitude, group.longitude]}
              icon={markerIcon}
              eventHandlers={{
                click: () => onActiveGroupChange?.(group.id),
              }}
            >
              <Tooltip permanent={isActive} direction="top" offset={[0, -12]} opacity={1}>
                <div className="max-w-48">
                  <div className="text-xs font-semibold">{group.name}</div>
                  {group.location && (
                    <div className={featureThemeClassName('timelineCivicTimelineMapNeutralText')}>
                      {group.location}
                    </div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export function OnboardingGroupMap({
  groups,
  activeGroupId,
  selectedGroupIds,
  onActiveGroupChange,
}: OnboardingGroupMapProps) {
  const { t } = useTranslation();
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

  const defaultIcon = useMemo(() => {
    if (!leafletModule) return null;

    return leafletModule.divIcon({
      className: '',
      html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${featureThemeValue('chartChartRendererInfoColorAlpha')};border:2px solid white;box-shadow:0 1px 6px rgba(15,23,42,.35);"></span>`,
      iconAnchor: [9, 9],
      iconSize: [18, 18],
    });
  }, [leafletModule]);

  const selectedIcon = useMemo(() => {
    if (!leafletModule) return null;

    return leafletModule.divIcon({
      className: '',
      html: `<span style="display:block;width:21px;height:21px;border-radius:9999px;background:${featureThemeValue('networkNetworkVisualHelpersSuccessColorAlpha')};border:3px solid white;box-shadow:0 10px 24px rgba(5,150,105,.35);"></span>`,
      iconAnchor: [10.5, 10.5],
      iconSize: [21, 21],
    });
  }, [leafletModule]);

  const activeIcon = useMemo(() => {
    if (!leafletModule) return null;

    return leafletModule.divIcon({
      className: '',
      html: featureThemeMarkup('timelineCivicTimelineMapMapMarkerMarkup'),
      iconAnchor: [12, 12],
      iconSize: [24, 24],
    });
  }, [leafletModule]);

  const activeGroup = groups.find(group => group.id === activeGroupId) ?? null;

  if (groups.length === 0) {
    return <OnboardingGroupMapMessage message={t('onboarding.groupStep.mapNoGroups')} />;
  }

  if (
    loadFailed ||
    !reactLeafletModule ||
    !leafletModule ||
    !defaultIcon ||
    !selectedIcon ||
    !activeIcon
  ) {
    return <OnboardingGroupMapMessage message={t('onboarding.groupStep.mapUnavailable')} />;
  }

  return (
    <OnboardingGroupMapView
      activeGroup={activeGroup}
      activeGroupId={activeGroupId}
      activeIcon={activeIcon}
      center={averageCenter(groups)}
      defaultIcon={defaultIcon}
      groups={groups}
      onActiveGroupChange={onActiveGroupChange}
      reactLeafletModule={reactLeafletModule}
      selectedGroupIds={selectedGroupIds}
      selectedIcon={selectedIcon}
      zoom={groups.length === 1 ? 10 : 6}
    />
  );
}

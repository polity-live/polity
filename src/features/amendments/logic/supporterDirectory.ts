import { formatLocation, type LocationParts } from '@/features/shared/logic/locationHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  geoLocationShapeFromFields,
  hasGeoLocationBounds,
  type GeoLocationShape,
} from '@/features/shared/logic/geoLocationShape';

type GroupDecisionStatus = 'supported' | 'accepted';
type SupportConfirmationStatus = 'pending' | 'confirmed' | 'declined' | 'withdrawn';

interface SupporterGroupLike extends LocationParts {
  id?: string | null;
  name?: string | null;
  member_count?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  location_kind?: string | null;
  location_place_id?: string | null;
  location_boundary_source?: string | null;
  location_geometry?: unknown | null;
  location_bounds?: unknown | null;
}

interface SupporterGroupDecisionLike {
  group_id?: string | null;
  status?: string | null;
  group?: SupporterGroupLike | null;
}

interface SupportConfirmationLike {
  group_id?: string | null;
  status?: string | null;
  created_at?: number | null;
  group?: SupporterGroupLike | null;
}

export type SupporterDirectoryStatus = 'active' | 'pending';

export interface SupporterDirectoryItem {
  groupId: string;
  name: string;
  href: string;
  memberCount: number;
  supportStatus: SupporterDirectoryStatus;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  locationShape?: GeoLocationShape | null;
}

export interface SupporterMapItem extends SupporterDirectoryItem {
  latitude: number;
  longitude: number;
}

const CURRENT_SUPPORTER_DECISION_STATUSES = new Set<GroupDecisionStatus>(['supported', 'accepted']);
const EXCLUDED_CONFIRMATION_STATUSES = new Set<SupportConfirmationStatus>([
  'declined',
  'withdrawn',
]);

function getGroupId(record: { group_id?: string | null; group?: { id?: string | null } | null }) {
  return record.group?.id ?? record.group_id ?? null;
}

function getCreatedAt(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toFiniteCoordinate(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function compareSupporterNames(left: SupporterDirectoryItem, right: SupporterDirectoryItem) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}

function mergeGroupData(
  primary?: SupporterGroupLike | null,
  fallback?: SupporterGroupLike | null
): SupporterGroupLike | undefined {
  if (!primary && !fallback) {
    return undefined;
  }

  const candidate = primary ?? fallback ?? undefined;
  if (!candidate) {
    return undefined;
  }

  return {
    ...fallback,
    ...primary,
    id: primary?.id ?? fallback?.id ?? null,
    name: primary?.name ?? fallback?.name ?? null,
    member_count: primary?.member_count ?? fallback?.member_count ?? null,
    latitude: primary?.latitude ?? fallback?.latitude ?? null,
    longitude: primary?.longitude ?? fallback?.longitude ?? null,
    location_kind: primary?.location_kind ?? fallback?.location_kind ?? null,
    location_place_id: primary?.location_place_id ?? fallback?.location_place_id ?? null,
    location_boundary_source:
      primary?.location_boundary_source ?? fallback?.location_boundary_source ?? null,
    location_geometry: primary?.location_geometry ?? fallback?.location_geometry ?? null,
    location_bounds: primary?.location_bounds ?? fallback?.location_bounds ?? null,
  };
}

function formatSupporterLocation(group?: SupporterGroupLike | null) {
  const formattedLocation = formatLocation(group);
  if (formattedLocation) {
    return formattedLocation;
  }

  const latitude = toFiniteCoordinate(group?.latitude);
  const longitude = toFiniteCoordinate(group?.longitude);
  if (latitude !== null && longitude !== null) {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }

  return translateText('features.amendments.wiki.locationNotSet');
}

export function deriveSupporterDirectoryItems(args: {
  groupDecisions?: readonly SupporterGroupDecisionLike[] | null;
  supportConfirmations?: readonly SupportConfirmationLike[] | null;
}): SupporterDirectoryItem[] {
  const latestConfirmationByGroupId = new Map<string, SupportConfirmationLike>();

  for (const confirmation of args.supportConfirmations ?? []) {
    const groupId = getGroupId(confirmation);
    if (!groupId) {
      continue;
    }

    const existingConfirmation = latestConfirmationByGroupId.get(groupId);
    if (
      !existingConfirmation ||
      getCreatedAt(confirmation.created_at) >= getCreatedAt(existingConfirmation.created_at)
    ) {
      latestConfirmationByGroupId.set(groupId, confirmation);
    }
  }

  const currentSupporterDecisionsByGroupId = new Map<string, SupporterGroupDecisionLike>();

  for (const decision of args.groupDecisions ?? []) {
    const groupId = getGroupId(decision);
    if (
      !groupId ||
      !CURRENT_SUPPORTER_DECISION_STATUSES.has(decision.status as GroupDecisionStatus)
    ) {
      continue;
    }

    const existingDecision = currentSupporterDecisionsByGroupId.get(groupId);
    if (!existingDecision || decision.status === 'accepted') {
      currentSupporterDecisionsByGroupId.set(groupId, decision);
    }
  }

  const items: SupporterDirectoryItem[] = [];

  for (const [groupId, decision] of currentSupporterDecisionsByGroupId) {
    const latestConfirmation = latestConfirmationByGroupId.get(groupId);
    const latestConfirmationStatus = latestConfirmation?.status as
      SupportConfirmationStatus | undefined;

    if (latestConfirmationStatus && EXCLUDED_CONFIRMATION_STATUSES.has(latestConfirmationStatus)) {
      continue;
    }

    const group = mergeGroupData(latestConfirmation?.group, decision.group);
    const latitude = toFiniteCoordinate(group?.latitude);
    const longitude = toFiniteCoordinate(group?.longitude);
    const locationShape = geoLocationShapeFromFields(group);

    items.push({
      groupId,
      name: group?.name?.trim() || translateText('features.amendments.wiki.unnamedGroup'),
      href: `/group/${groupId}`,
      memberCount: Math.max(0, group?.member_count ?? 0),
      supportStatus: latestConfirmationStatus === 'pending' ? 'pending' : 'active',
      locationLabel: formatSupporterLocation(group),
      latitude,
      longitude,
      locationShape,
    });
  }

  return items.sort(compareSupporterNames);
}

export function deriveSupporterMapItems(
  items: readonly SupporterDirectoryItem[]
): SupporterMapItem[] {
  return items.flatMap(item => {
    if (item.latitude !== null && item.longitude !== null) {
      return [{ ...item, latitude: item.latitude, longitude: item.longitude }];
    }

    if (hasGeoLocationBounds(item.locationShape)) {
      return [
        {
          ...item,
          latitude: (item.locationShape.bounds.south + item.locationShape.bounds.north) / 2,
          longitude: (item.locationShape.bounds.west + item.locationShape.bounds.east) / 2,
        },
      ];
    }

    return [];
  });
}

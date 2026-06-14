import type { ContentType } from '../constants/content-type-config';

export type CivicTimelineType =
  | 'group'
  | 'event'
  | 'amendment'
  | 'agenda_item'
  | 'vote'
  | 'election'
  | 'statement'
  | 'blog'
  | 'workflow'
  | 'user';

export type CivicTimelineReason =
  | 'subscribed'
  | 'member_context'
  | 'near_you'
  | 'active_now'
  | 'popular_nearby'
  | 'public_discovery'
  | 'urgent_decision';

export type CivicTimelineSectionId = 'now' | 'today' | 'this_week' | 'later' | 'discover';

export interface CivicTimelineCoordinates {
  latitude: number;
  longitude: number;
}

export interface CivicTimelineItem {
  id: string;
  entityId?: string;
  type: CivicTimelineType;
  title: string;
  description?: string | null;
  href: string;
  sourceName?: string | null;
  sourceHref?: string | null;
  timestamp: Date;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: string | null;
  locationLabel?: string | null;
  coordinates?: CivicTimelineCoordinates | null;
  tags?: string[];
  stats?: {
    reactions?: number;
    comments?: number;
    views?: number;
    members?: number;
    participants?: number;
    candidates?: number;
  };
  statsLabel?: string | null;
  primaryActionLabel?: string;
  relationshipStrength?: number;
  urgency?: number;
  engagementScore?: number;
  isDiscover?: boolean;
  reason: CivicTimelineReason;
  distanceKm?: number | null;
  score?: number;
  scoreBreakdown?: CivicTimelineScoreBreakdown;
}

export interface CivicTimelineScoreBreakdown {
  relationship: number;
  proximity: number;
  urgency: number;
  freshness: number;
  engagement: number;
  diversity: number;
}

export interface CivicTimelineUserContext {
  userId: string;
  coordinates?: CivicTimelineCoordinates | null;
  now?: Date;
}

export interface CivicTimelineSection {
  id: CivicTimelineSectionId;
  labelKey: string;
  items: CivicTimelineItem[];
}

export const CIVIC_TIMELINE_CONTENT_TYPES: ContentType[] = [
  'event',
  'agenda_item',
  'vote',
  'election',
  'amendment',
  'statement',
  'blog',
  'group',
  'user',
  'workflow',
];

const SCORING_WEIGHTS = {
  relationship: 30,
  proximity: 25,
  urgency: 20,
  freshness: 15,
  engagement: 5,
  diversity: 5,
} as const;

const SECTION_LABEL_KEYS: Record<CivicTimelineSectionId, string> = {
  now: 'features.timeline.around.sections.now',
  today: 'features.timeline.around.sections.today',
  this_week: 'features.timeline.around.sections.thisWeek',
  later: 'features.timeline.around.sections.later',
  discover: 'features.timeline.around.sections.discover',
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asDate(value: Date | number | string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function deriveCivicCoordinates(
  ...sources: (
    | {
        latitude?: number | null;
        longitude?: number | null;
        lat?: number | null;
        lon?: number | null;
      }
    | null
    | undefined
  )[]
): CivicTimelineCoordinates | null {
  for (const source of sources) {
    if (!source) continue;

    const latitude = isFiniteCoordinate(source.latitude) ? source.latitude : source.lat;
    const longitude = isFiniteCoordinate(source.longitude) ? source.longitude : source.lon;

    if (isFiniteCoordinate(latitude) && isFiniteCoordinate(longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

export function calculateDistanceKm(
  from?: CivicTimelineCoordinates | null,
  to?: CivicTimelineCoordinates | null
): number | null {
  if (!from || !to) return null;

  const earthRadiusKm = 6371;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function getCivicTimelineTimestamp(
  item: Pick<CivicTimelineItem, 'timestamp' | 'startDate'>
) {
  return asDate(item.startDate) ?? asDate(item.timestamp) ?? new Date();
}

function calculateProximityScore(distanceKm: number | null): number {
  if (distanceKm == null) {
    return 0.5;
  }

  if (distanceKm <= 5) return 1;
  if (distanceKm <= 25) return 0.85;
  if (distanceKm <= 100) return 0.65;
  if (distanceKm <= 300) return 0.4;

  return clamp(0.25 - distanceKm / 4000, 0.08, 0.25);
}

function calculateFreshnessScore(item: CivicTimelineItem, now: Date): number {
  const timestamp = getCivicTimelineTimestamp(item);
  const ageHours = Math.abs(now.getTime() - timestamp.getTime()) / 3_600_000;

  return Math.pow(0.5, ageHours / (24 * 7));
}

function calculateUrgencyScore(item: CivicTimelineItem, now: Date): number {
  if (typeof item.urgency === 'number') {
    return clamp(item.urgency);
  }

  const startDate = asDate(item.startDate);
  const endDate = asDate(item.endDate);
  const nowTime = now.getTime();

  if (startDate && endDate && startDate.getTime() <= nowTime && endDate.getTime() >= nowTime) {
    return 1;
  }

  if (endDate && endDate.getTime() >= nowTime) {
    const hoursUntilEnd = (endDate.getTime() - nowTime) / 3_600_000;
    if (hoursUntilEnd <= 6) return 1;
    if (hoursUntilEnd <= 48) return 0.8;
    if (hoursUntilEnd <= 168) return 0.45;
  }

  if (startDate && startDate.getTime() >= nowTime) {
    const hoursUntilStart = (startDate.getTime() - nowTime) / 3_600_000;
    if (hoursUntilStart <= 12) return 0.9;
    if (hoursUntilStart <= 72) return 0.65;
    if (hoursUntilStart <= 168) return 0.35;
  }

  return item.type === 'vote' || item.type === 'election' ? 0.25 : 0.1;
}

function calculateEngagementScore(item: CivicTimelineItem): number {
  const rawScore =
    item.engagementScore ??
    (item.stats?.reactions ?? 0) * 2 +
      (item.stats?.comments ?? 0) * 3 +
      (item.stats?.views ?? 0) * 0.01 +
      (item.stats?.members ?? 0) * 0.1 +
      (item.stats?.participants ?? 0) * 0.5 +
      (item.stats?.candidates ?? 0);

  if (rawScore <= 0) return 0;
  return clamp(Math.log10(rawScore + 1) / 3);
}

export function scoreCivicTimelineItem(
  item: CivicTimelineItem,
  context: CivicTimelineUserContext
): CivicTimelineItem {
  const now = context.now ?? new Date();
  const distanceKm = calculateDistanceKm(context.coordinates, item.coordinates);
  const breakdown: CivicTimelineScoreBreakdown = {
    relationship:
      clamp(item.relationshipStrength ?? (item.isDiscover ? 0 : 0.65)) *
      SCORING_WEIGHTS.relationship,
    proximity: calculateProximityScore(distanceKm) * SCORING_WEIGHTS.proximity,
    urgency: calculateUrgencyScore(item, now) * SCORING_WEIGHTS.urgency,
    freshness: calculateFreshnessScore(item, now) * SCORING_WEIGHTS.freshness,
    engagement: calculateEngagementScore(item) * SCORING_WEIGHTS.engagement,
    diversity: SCORING_WEIGHTS.diversity,
  };

  return {
    ...item,
    distanceKm,
    score:
      breakdown.relationship +
      breakdown.proximity +
      breakdown.urgency +
      breakdown.freshness +
      breakdown.engagement +
      breakdown.diversity,
    scoreBreakdown: breakdown,
  };
}

export function rankCivicTimelineItems(
  items: CivicTimelineItem[],
  context: CivicTimelineUserContext
): CivicTimelineItem[] {
  const typeCounts = new Map<CivicTimelineType, number>();

  return items
    .map(item => scoreCivicTimelineItem(item, context))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .map(item => {
      const count = typeCounts.get(item.type) ?? 0;
      typeCounts.set(item.type, count + 1);

      if (count === 0) return item;

      const diversityPenalty = Math.min(count * 2.5, SCORING_WEIGHTS.diversity);
      const nextDiversity = Math.max(0, SCORING_WEIGHTS.diversity - diversityPenalty);
      const currentDiversity = item.scoreBreakdown?.diversity ?? SCORING_WEIGHTS.diversity;

      return {
        ...item,
        score: (item.score ?? 0) - currentDiversity + nextDiversity,
        scoreBreakdown: item.scoreBreakdown
          ? { ...item.scoreBreakdown, diversity: nextDiversity }
          : item.scoreBreakdown,
      };
    })
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
}

function itemDedupeKey(item: CivicTimelineItem) {
  return `${item.type}:${item.entityId ?? item.id}`;
}

export function buildCivicTimelineItems(args: {
  primaryItems: CivicTimelineItem[];
  discoverItems: CivicTimelineItem[];
  context: CivicTimelineUserContext;
  minPrimaryItems?: number;
}): CivicTimelineItem[] {
  const minPrimaryItems = args.minPrimaryItems ?? 8;
  const primaryItems = rankCivicTimelineItems(args.primaryItems, args.context);
  const seenKeys = new Set(primaryItems.map(itemDedupeKey));

  if (primaryItems.length >= minPrimaryItems) {
    return primaryItems;
  }

  const discoverNeeded = minPrimaryItems - primaryItems.length;
  const discoverItems = rankCivicTimelineItems(
    args.discoverItems
      .filter(item => !seenKeys.has(itemDedupeKey(item)))
      .map(item => ({ ...item, isDiscover: true, reason: item.reason ?? 'public_discovery' })),
    args.context
  ).slice(0, Math.max(discoverNeeded, 4));

  return rankCivicTimelineItems([...primaryItems, ...discoverItems], args.context);
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getSectionId(item: CivicTimelineItem, now: Date): CivicTimelineSectionId {
  if (item.isDiscover) return 'discover';

  const startDate = asDate(item.startDate);
  const endDate = asDate(item.endDate);
  const timestamp = getCivicTimelineTimestamp(item);
  const nowTime = now.getTime();

  if (startDate && endDate && startDate.getTime() <= nowTime && endDate.getTime() >= nowTime) {
    return 'now';
  }

  if (item.type === 'vote' || item.type === 'election') {
    if (endDate && endDate.getTime() >= nowTime && endDate.getTime() - nowTime <= 48 * 3_600_000) {
      return 'now';
    }
  }

  if (isSameCalendarDay(timestamp, now)) {
    return 'today';
  }

  const diffDays = (timestamp.getTime() - nowTime) / 86_400_000;
  if (diffDays >= 0 && diffDays <= 7) return 'this_week';
  if (diffDays > 7) return 'later';

  return 'this_week';
}

export function groupCivicTimelineItems(
  items: CivicTimelineItem[],
  now: Date = new Date()
): CivicTimelineSection[] {
  const grouped = new Map<CivicTimelineSectionId, CivicTimelineItem[]>();
  const order: CivicTimelineSectionId[] = ['now', 'today', 'this_week', 'later', 'discover'];

  for (const item of items) {
    const sectionId = getSectionId(item, now);
    const sectionItems = grouped.get(sectionId) ?? [];
    sectionItems.push(item);
    grouped.set(sectionId, sectionItems);
  }

  return order.flatMap(id => {
    const sectionItems = grouped.get(id) ?? [];
    return sectionItems.length > 0
      ? [
          {
            id,
            labelKey: SECTION_LABEL_KEYS[id],
            items: sectionItems,
          },
        ]
      : [];
  });
}

export function isWithinTimelineRadius(
  item: CivicTimelineItem,
  radiusKm: number | 'all',
  userCoordinates?: CivicTimelineCoordinates | null
) {
  if (radiusKm === 'all' || !userCoordinates || !item.coordinates) {
    return true;
  }

  const distanceKm = calculateDistanceKm(userCoordinates, item.coordinates);
  return distanceKm == null || distanceKm <= radiusKm;
}

export function formatDistanceKm(distanceKm?: number | null) {
  if (distanceKm == null) return null;
  if (distanceKm < 1) return '<1 km';
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

import type { SearchDocument, SearchDocumentCardPayload } from '../types/search-document.types';
import { translate } from '@/features/shared/hooks/use-translation';

export interface SearchBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SpatialCoordinates {
  latitude: number;
  longitude: number;
}

export interface SpatialLocationCandidate {
  latitude?: number | string | null;
  longitude?: number | string | null;
  label?: string | null;
  source?: string | null;
}

export interface ResolvedSpatialLocation {
  coordinates: SpatialCoordinates;
  label: string | null;
  source: string;
}

export interface SearchSpatialItem {
  id: string;
  document: SearchDocument;
  type: string;
  title: string;
  locationLabel: string | null;
  locationSource: string;
  coordinates: SpatialCoordinates;
}

export const GERMANY_CENTER: [number, number] = [51.1657, 10.4515];

export const GERMANY_SEARCH_BOUNDS: SearchBounds = {
  north: 55.2,
  south: 47.2,
  east: 15.5,
  west: 5.5,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asPayload(value: unknown): SearchDocumentCardPayload {
  return isRecord(value) ? (value as SearchDocumentCardPayload) : {};
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeCandidate(
  candidate: SpatialLocationCandidate | null | undefined,
  source: string
): ResolvedSpatialLocation | null {
  if (!candidate) return null;

  const latitude = toFiniteNumber(candidate.latitude);
  const longitude = toFiniteNumber(candidate.longitude);
  if (latitude === null || longitude === null) return null;

  return {
    coordinates: { latitude, longitude },
    label: candidate.label?.trim() || null,
    source: candidate.source?.trim() || source,
  };
}

export function resolveSpatialLocation({
  own,
  group,
  owner,
}: {
  own?: SpatialLocationCandidate | null;
  group?: SpatialLocationCandidate | null;
  owner?: SpatialLocationCandidate | null;
}): ResolvedSpatialLocation | null {
  return (
    normalizeCandidate(own, 'own') ??
    normalizeCandidate(group, 'group') ??
    normalizeCandidate(owner, 'owner') ??
    null
  );
}

export function resolveSearchDocumentSpatialLocation(
  document: SearchDocument
): ResolvedSpatialLocation | null {
  return resolveSpatialLocation({
    own: {
      latitude: document.location_latitude,
      longitude: document.location_longitude,
      label: document.location_label ?? null,
      source: document.location_source ?? 'document',
    },
  });
}

export function getSearchSpatialType(document: SearchDocument): string {
  const payload = asPayload(document.card_payload);
  return String(payload.type || payload.entity_type || document.entity_type || 'result').trim();
}

export function mapSearchDocumentToSpatialItem(document: SearchDocument): SearchSpatialItem | null {
  const location = resolveSearchDocumentSpatialLocation(document);
  if (!location) return null;

  return {
    id: document.id,
    document,
    type: getSearchSpatialType(document),
    title: document.title || translate('common.entities.result'),
    locationLabel: location.label,
    locationSource: location.source,
    coordinates: location.coordinates,
  };
}

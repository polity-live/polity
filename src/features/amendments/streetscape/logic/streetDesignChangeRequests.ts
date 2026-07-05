import type { StreetDesignLocalPoint, StreetDesignObject, StreetDesignStateV1 } from '../types';
import { getStreetDesignGeometryCenter } from './streetDesignPlacement';

export interface StreetDesignChangeRequest {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  source_title?: string | null;
  change_type?: string | null;
  original_properties?: unknown;
  new_properties?: unknown;
  votes_for?: number | null;
  votes_against?: number | null;
  votes_abstain?: number | null;
  voting_status?: string | null;
  updated_at?: string | number | null;
  votes?:
    | readonly { vote_choice?: string | null; choice?: string | null; user_id?: string | null }[]
    | null;
}

export type StreetDesignChangeRequestTone = 'add' | 'remove' | 'update' | 'neutral';

export interface StreetDesignChangeRequestMarker {
  id: string;
  label: string;
  tone: StreetDesignChangeRequestTone;
  leftPercent: number;
  topPercent: number;
}

export interface StreetDesignChangeRequestDiffRow {
  key: string;
  before: string;
  after: string;
}

const STREET_DESIGN_SOURCE_TYPES = new Set([
  'street_design',
  'street_design_area',
  'street_design_layer',
  'street_design_object',
  'streetscape',
  'streetscape_area',
  'streetscape_layer',
  'streetscape_object',
]);

export function isStreetDesignChangeRequest(
  changeRequest: Pick<StreetDesignChangeRequest, 'source_type'>
): boolean {
  const sourceType = changeRequest.source_type?.trim().toLowerCase();
  if (!sourceType) return false;

  return STREET_DESIGN_SOURCE_TYPES.has(sourceType) || sourceType.startsWith('street_design_');
}

export function getStreetDesignChangeRequests(
  changeRequests: readonly StreetDesignChangeRequest[] | null | undefined
) {
  return [...(changeRequests ?? [])].filter(isStreetDesignChangeRequest).sort((a, b) => {
    const statusA = a.status === 'open' || a.voting_status === 'open' ? 0 : 1;
    const statusB = b.status === 'open' || b.voting_status === 'open' ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;

    return getTimestamp(b.updated_at) - getTimestamp(a.updated_at);
  });
}

export function getStreetDesignChangeRequestTone(
  changeRequest: Pick<StreetDesignChangeRequest, 'change_type'>
): StreetDesignChangeRequestTone {
  switch (changeRequest.change_type) {
    case 'add':
    case 'insert':
      return 'add';
    case 'delete':
    case 'remove':
      return 'remove';
    case 'replace':
    case 'update':
      return 'update';
    default:
      return 'neutral';
  }
}

export function formatStreetDesignChangeRequestIdentifier(
  changeRequest: Pick<StreetDesignChangeRequest, 'id'>
) {
  return `CR-${changeRequest.id.slice(0, 8)}`;
}

export function formatStreetDesignChangeRequestTitle(
  changeRequest: Pick<StreetDesignChangeRequest, 'id' | 'title' | 'source_title' | 'change_type'>
) {
  return (
    changeRequest.title ??
    changeRequest.source_title ??
    `${normalizeChangeTypeLabel(changeRequest.change_type)} ${formatStreetDesignChangeRequestIdentifier(changeRequest)}`
  );
}

export function getStreetDesignChangeRequestObjectId(
  changeRequest: Pick<
    StreetDesignChangeRequest,
    'source_id' | 'original_properties' | 'new_properties'
  >
) {
  return (
    changeRequest.source_id ??
    getStreetDesignObjectSnapshot(changeRequest.new_properties)?.id ??
    getStreetDesignObjectSnapshot(changeRequest.original_properties)?.id ??
    null
  );
}

export function getStreetDesignChangeRequestMarker(
  changeRequest: StreetDesignChangeRequest,
  design: StreetDesignStateV1
): StreetDesignChangeRequestMarker {
  const point = getStreetDesignChangeRequestPosition(changeRequest, design);

  return {
    id: changeRequest.id,
    label: formatStreetDesignChangeRequestTitle(changeRequest),
    tone: getStreetDesignChangeRequestTone(changeRequest),
    leftPercent: clamp(50 + point.x * 1.2, 8, 92),
    topPercent: clamp(50 - point.z * 1.2, 8, 92),
  };
}

export function getStreetDesignChangeRequestDiffRows(
  changeRequest: Pick<StreetDesignChangeRequest, 'original_properties' | 'new_properties'>
): StreetDesignChangeRequestDiffRow[] {
  const before = getComparableProperties(changeRequest.original_properties);
  const after = getComparableProperties(changeRequest.new_properties);
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();

  return keys
    .filter(key => stringifyDiffValue(before[key]) !== stringifyDiffValue(after[key]))
    .map(key => ({
      key,
      before: stringifyDiffValue(before[key]),
      after: stringifyDiffValue(after[key]),
    }));
}

function getStreetDesignChangeRequestPosition(
  changeRequest: StreetDesignChangeRequest,
  design: StreetDesignStateV1
): StreetDesignLocalPoint {
  const objectId = getStreetDesignChangeRequestObjectId(changeRequest);
  const designObject = objectId ? design.objects.find(object => object.id === objectId) : null;
  if (designObject) return getStreetDesignGeometryCenter(designObject.geometry);

  const snapshot =
    getStreetDesignObjectSnapshot(changeRequest.new_properties) ??
    getStreetDesignObjectSnapshot(changeRequest.original_properties);
  if (snapshot) return getStreetDesignGeometryCenter(snapshot.geometry);

  return { x: 0, z: 0 };
}

function getStreetDesignObjectSnapshot(value: unknown): StreetDesignObject | null {
  const record = asRecord(value);
  if (!record) return null;

  const object = asStreetDesignObject(record.object);
  if (object) return object;

  const direct = asStreetDesignObject(record);
  if (direct) return direct;

  const objects = Array.isArray(record.objects) ? record.objects : null;
  return objects?.map(asStreetDesignObject).find(Boolean) ?? null;
}

function asStreetDesignObject(value: unknown): StreetDesignObject | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== 'string' || typeof record.type !== 'string') return null;
  if (!isStreetDesignGeometry(record.geometry)) return null;

  return record as unknown as StreetDesignObject;
}

function isStreetDesignGeometry(value: unknown): value is StreetDesignObject['geometry'] {
  const record = asRecord(value);
  if (!record || typeof record.kind !== 'string') return false;

  if (record.kind === 'point') return asRecord(record.point) != null;
  if (record.kind === 'corridor')
    return asRecord(record.start) != null && asRecord(record.end) != null;
  if (record.kind === 'path_corridor') return Array.isArray(record.points);
  if (record.kind === 'polygon') return Array.isArray(record.points);
  return false;
}

function getComparableProperties(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) return {};

  const object = asRecord(record.object);
  const objectProperties = asRecord(object?.properties);
  if (objectProperties) return objectProperties;

  const properties = asRecord(record.properties);
  if (properties) return properties;

  const result: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, entry]) => {
    if (['id', 'type', 'geometry', 'cost', 'object', 'objects'].includes(key)) return;
    result[key] = entry;
  });
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeChangeTypeLabel(value?: string | null) {
  if (!value) return 'Change';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stringifyDiffValue(value: unknown) {
  if (value === undefined) return '-';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  return JSON.stringify(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTimestamp(value: string | number | null | undefined) {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

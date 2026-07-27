import type { CityDesignLocalPoint, CityDesignObject, CityDesignStateV1 } from '../types';
import { getCityDesignGeometryCenter } from './cityDesignPlacement';
import { getCityDesignObjectSnapshot } from './cityDesignChangeRequestDiff';

export interface CityDesignChangeRequest {
  id: string;
  display_cr_id?: string | null;
  displayCrId?: string | null;
  discussion_id?: string | null;
  discussionId?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  user_id?: string | null;
  userId?: string | null;
  user?: {
    id?: string | null;
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
  } | null;
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
  voting_deadline?: string | number | null;
  close_trigger?: string | null;
  eligible_voter_count?: number | null;
  eligibleVoterCount?: number | null;
  voted_collaborator_count?: number | null;
  votedCollaboratorCount?: number | null;
  created_at?: string | number | null;
  updated_at?: string | number | null;
  votes?:
    | readonly {
        id?: string | null;
        vote?: string | null;
        vote_choice?: string | null;
        choice?: string | null;
        user_id?: string | null;
        userId?: string | null;
      }[]
    | null;
}

export type CityDesignChangeRequestTone = 'add' | 'remove' | 'update' | 'neutral';
export type CityDesignChangeRequestColorMode = 'natural' | 'tinted';

export interface CityDesignPreviewSource {
  id?: string | null;
  title?: string | null;
  design_state?: unknown;
  designState?: unknown;
}

export interface CityDesignChangeRequestMarker {
  id: string;
  label: string;
  displayId: string;
  title: string;
  tone: CityDesignChangeRequestTone;
  position: CityDesignLocalPoint;
  leftPercent: number;
  topPercent: number;
}

export interface CityDesignChangeRequestDiffRow {
  key: string;
  before: string;
  after: string;
}

export interface CityDesignChangeRequestOverlayObject {
  id: string;
  changeRequestId: string;
  object: CityDesignObject;
  tone: Exclude<CityDesignChangeRequestTone, 'neutral'>;
}

const CITY_DESIGN_SOURCE_TYPES = new Set([
  'city_design_area',
  'city_design_layer',
  'city_design_scene',
  'city_design_object',
]);

export function isCityDesignChangeRequest(
  changeRequest: Pick<CityDesignChangeRequest, 'source_type'>
): boolean {
  const sourceType = changeRequest.source_type?.trim().toLowerCase();
  if (!sourceType) return false;

  return CITY_DESIGN_SOURCE_TYPES.has(sourceType) || sourceType.startsWith('city_design_');
}

export function getCityDesignChangeRequests(
  changeRequests: readonly CityDesignChangeRequest[] | null | undefined
) {
  return [...(changeRequests ?? [])].filter(isCityDesignChangeRequest).sort((a, b) => {
    const statusA = isOpenCityDesignChangeRequest(a) ? 0 : 1;
    const statusB = isOpenCityDesignChangeRequest(b) ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;

    return getTimestamp(b.updated_at) - getTimestamp(a.updated_at);
  });
}

export function isOpenCityDesignChangeRequest(
  changeRequest: Pick<CityDesignChangeRequest, 'status' | 'voting_status'>
) {
  const status = changeRequest.status?.trim().toLowerCase();
  const votingStatus = changeRequest.voting_status?.trim().toLowerCase();

  if (votingStatus === 'completed') return false;
  if (
    status &&
    ['accepted', 'rejected', 'approved', 'declined', 'closed', 'resolved'].includes(status)
  ) {
    return false;
  }

  return true;
}

export function getCityDesignChangeRequestTone(
  changeRequest: Pick<CityDesignChangeRequest, 'change_type'>
): CityDesignChangeRequestTone {
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

export function formatCityDesignChangeRequestIdentifier(
  changeRequest: Pick<CityDesignChangeRequest, 'id' | 'display_cr_id' | 'displayCrId'>
) {
  return (
    changeRequest.display_cr_id ?? changeRequest.displayCrId ?? `CR-${changeRequest.id.slice(0, 8)}`
  );
}

export function formatCityDesignChangeRequestTitle(
  changeRequest: Pick<
    CityDesignChangeRequest,
    'id' | 'display_cr_id' | 'displayCrId' | 'title' | 'source_title' | 'change_type'
  >
) {
  return (
    changeRequest.title ??
    changeRequest.source_title ??
    `${normalizeChangeTypeLabel(changeRequest.change_type)} ${formatCityDesignChangeRequestIdentifier(changeRequest)}`
  );
}

export function getCityDesignChangeRequestDiscussionId(
  changeRequest: Pick<CityDesignChangeRequest, 'id' | 'discussion_id' | 'discussionId'>
) {
  return (
    changeRequest.discussion_id ??
    changeRequest.discussionId ??
    `city-design-cr:${changeRequest.id}`
  );
}

export function getCityDesignChangeRequestObjectId(
  changeRequest: Pick<
    CityDesignChangeRequest,
    'source_id' | 'original_properties' | 'new_properties'
  >
) {
  return (
    changeRequest.source_id ??
    getCityDesignObjectSnapshot(changeRequest.new_properties)?.id ??
    getCityDesignObjectSnapshot(changeRequest.original_properties)?.id ??
    null
  );
}

export function getCityDesignChangeRequestCityDesignId(
  changeRequest: Pick<
    CityDesignChangeRequest,
    'source_type' | 'source_id' | 'original_properties' | 'new_properties'
  >
) {
  return (
    getSnapshotCityDesignId(changeRequest.new_properties) ??
    getSnapshotCityDesignId(changeRequest.original_properties) ??
    (changeRequest.source_type === 'city_design_scene' ? changeRequest.source_id : null) ??
    null
  );
}

export function getCityDesignChangeRequestMarker(
  changeRequest: CityDesignChangeRequest,
  design: CityDesignStateV1
): CityDesignChangeRequestMarker {
  const point = getCityDesignChangeRequestPosition(changeRequest, design);

  return {
    id: changeRequest.id,
    label: `${formatCityDesignChangeRequestIdentifier(changeRequest)} ${formatCityDesignChangeRequestTitle(changeRequest)}`,
    displayId: formatCityDesignChangeRequestIdentifier(changeRequest),
    title: formatCityDesignChangeRequestTitle(changeRequest),
    tone: getCityDesignChangeRequestTone(changeRequest),
    position: point,
    leftPercent: clamp(50 + point.x * 1.2, 8, 92),
    topPercent: clamp(50 - point.z * 1.2, 8, 92),
  };
}

export function getCityDesignChangeRequestDiffRows(
  changeRequest: Pick<CityDesignChangeRequest, 'original_properties' | 'new_properties'>
): CityDesignChangeRequestDiffRow[] {
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

export function getCityDesignChangeRequestOverlayObjects(
  changeRequests: readonly CityDesignChangeRequest[] | null | undefined
): CityDesignChangeRequestOverlayObject[] {
  return (changeRequests ?? []).flatMap(changeRequest => {
    const before = getCityDesignObjectSnapshot(changeRequest.original_properties);
    const after = getCityDesignObjectSnapshot(changeRequest.new_properties);
    const tone = getCityDesignChangeRequestTone(changeRequest);

    if (tone === 'add' && after) {
      return [
        {
          id: `${changeRequest.id}:add:${after.id}`,
          changeRequestId: changeRequest.id,
          object: after,
          tone: 'add' as const,
        },
      ];
    }

    if (tone === 'remove' && before) {
      return [
        {
          id: `${changeRequest.id}:remove:${before.id}`,
          changeRequestId: changeRequest.id,
          object: before,
          tone: 'remove' as const,
        },
      ];
    }

    if (before || after) {
      const overlays: CityDesignChangeRequestOverlayObject[] = [];
      if (before) {
        overlays.push({
          id: `${changeRequest.id}:update-before:${before.id}`,
          changeRequestId: changeRequest.id,
          object: before,
          tone: 'remove',
        });
      }
      if (after) {
        overlays.push({
          id: `${changeRequest.id}:update-after:${after.id}`,
          changeRequestId: changeRequest.id,
          object: after,
          tone: 'add',
        });
      }
      return overlays;
    }

    return [];
  });
}

function getCityDesignChangeRequestPosition(
  changeRequest: CityDesignChangeRequest,
  design: CityDesignStateV1
): CityDesignLocalPoint {
  const objectId = getCityDesignChangeRequestObjectId(changeRequest);
  const designObject = objectId ? design.objects.find(object => object.id === objectId) : null;
  if (designObject) return getCityDesignGeometryCenter(designObject.geometry);

  const snapshot =
    getCityDesignObjectSnapshot(changeRequest.new_properties) ??
    getCityDesignObjectSnapshot(changeRequest.original_properties);
  if (snapshot) return getCityDesignGeometryCenter(snapshot.geometry);

  return { x: 0, z: 0 };
}

function getComparableProperties(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) return {};

  const object = asRecord(record.object);
  const objectProperties = asRecord(object?.properties);
  if (objectProperties) return objectProperties;

  const scene = asRecord(record.scene);
  if (scene) {
    return Object.fromEntries(
      Object.entries(scene).filter(
        ([key]) => !['osmSnapshot', 'origin', 'mapSelection'].includes(key)
      )
    );
  }

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

function getSnapshotCityDesignId(value: unknown) {
  const record = asRecord(value);
  const id = record?.cityDesignId;
  return typeof id === 'string' && id.trim().length > 0 ? id : null;
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

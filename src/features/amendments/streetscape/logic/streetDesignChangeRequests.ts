import type { StreetDesignLocalPoint, StreetDesignObject, StreetDesignStateV1 } from '../types';
import { getStreetDesignGeometryCenter } from './streetDesignPlacement';
import { getStreetDesignObjectSnapshot } from './streetDesignChangeRequestDiff';

export interface StreetDesignChangeRequest {
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

export type StreetDesignChangeRequestTone = 'add' | 'remove' | 'update' | 'neutral';
export type StreetDesignChangeRequestColorMode = 'natural' | 'tinted';

export interface StreetDesignPreviewSource {
  id?: string | null;
  title?: string | null;
  design_state?: unknown;
  designState?: unknown;
}

export interface StreetDesignChangeRequestMarker {
  id: string;
  label: string;
  displayId: string;
  title: string;
  tone: StreetDesignChangeRequestTone;
  position: StreetDesignLocalPoint;
  leftPercent: number;
  topPercent: number;
}

export interface StreetDesignChangeRequestDiffRow {
  key: string;
  before: string;
  after: string;
}

export interface StreetDesignChangeRequestOverlayObject {
  id: string;
  changeRequestId: string;
  object: StreetDesignObject;
  tone: Exclude<StreetDesignChangeRequestTone, 'neutral'>;
}

const STREET_DESIGN_SOURCE_TYPES = new Set([
  'street_design',
  'street_design_area',
  'street_design_layer',
  'street_design_scene',
  'street_design_object',
  'streetscape',
  'streetscape_area',
  'streetscape_layer',
  'streetscape_scene',
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
    const statusA = isOpenStreetDesignChangeRequest(a) ? 0 : 1;
    const statusB = isOpenStreetDesignChangeRequest(b) ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;

    return getTimestamp(b.updated_at) - getTimestamp(a.updated_at);
  });
}

export function isOpenStreetDesignChangeRequest(
  changeRequest: Pick<StreetDesignChangeRequest, 'status' | 'voting_status'>
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
  changeRequest: Pick<StreetDesignChangeRequest, 'id' | 'display_cr_id' | 'displayCrId'>
) {
  return (
    changeRequest.display_cr_id ?? changeRequest.displayCrId ?? `CR-${changeRequest.id.slice(0, 8)}`
  );
}

export function formatStreetDesignChangeRequestTitle(
  changeRequest: Pick<
    StreetDesignChangeRequest,
    'id' | 'display_cr_id' | 'displayCrId' | 'title' | 'source_title' | 'change_type'
  >
) {
  return (
    changeRequest.title ??
    changeRequest.source_title ??
    `${normalizeChangeTypeLabel(changeRequest.change_type)} ${formatStreetDesignChangeRequestIdentifier(changeRequest)}`
  );
}

export function getStreetDesignChangeRequestDiscussionId(
  changeRequest: Pick<StreetDesignChangeRequest, 'id' | 'discussion_id' | 'discussionId'>
) {
  return (
    changeRequest.discussion_id ??
    changeRequest.discussionId ??
    `street-design-cr:${changeRequest.id}`
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

export function getStreetDesignChangeRequestStreetDesignId(
  changeRequest: Pick<
    StreetDesignChangeRequest,
    'source_type' | 'source_id' | 'original_properties' | 'new_properties'
  >
) {
  return (
    getSnapshotStreetDesignId(changeRequest.new_properties) ??
    getSnapshotStreetDesignId(changeRequest.original_properties) ??
    (changeRequest.source_type === 'street_design_scene' ? changeRequest.source_id : null) ??
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
    label: `${formatStreetDesignChangeRequestIdentifier(changeRequest)} ${formatStreetDesignChangeRequestTitle(changeRequest)}`,
    displayId: formatStreetDesignChangeRequestIdentifier(changeRequest),
    title: formatStreetDesignChangeRequestTitle(changeRequest),
    tone: getStreetDesignChangeRequestTone(changeRequest),
    position: point,
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

export function getStreetDesignChangeRequestOverlayObjects(
  changeRequests: readonly StreetDesignChangeRequest[] | null | undefined
): StreetDesignChangeRequestOverlayObject[] {
  return (changeRequests ?? []).flatMap(changeRequest => {
    const before = getStreetDesignObjectSnapshot(changeRequest.original_properties);
    const after = getStreetDesignObjectSnapshot(changeRequest.new_properties);
    const tone = getStreetDesignChangeRequestTone(changeRequest);

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
      const overlays: StreetDesignChangeRequestOverlayObject[] = [];
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

function getSnapshotStreetDesignId(value: unknown) {
  const record = asRecord(value);
  const id = record?.streetDesignId;
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

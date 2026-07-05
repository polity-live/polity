import type { ReadonlyJSONValue } from '@rocicorp/zero';
import type { StreetDesignObject, StreetDesignStateV1 } from '../types';
import { getStreetDesignCostSummary } from './streetDesignCosting';
import {
  STREET_DESIGN_COST_CATALOG_VERSION,
  STREET_DESIGN_CURRENCY,
} from './streetDesignObjectRegistry';
import {
  createEmptyStreetDesignState,
  normalizeStreetDesignStateV1,
  parseStoredStreetDesignState,
} from '../state/streetDesignReducer';

export type StreetDesignChangeType = 'insert' | 'update' | 'delete';

export interface StreetDesignChangeRequestSnapshot {
  streetDesignId: string | null;
  objectId: string | null;
  object?: StreetDesignObject;
  scene?: StreetDesignSceneSnapshot;
  designContext?: StreetDesignSceneSnapshot;
}

export interface StreetDesignSceneSnapshot {
  origin: StreetDesignStateV1['origin'];
  mapSelection?: StreetDesignStateV1['mapSelection'];
  osmSnapshot: StreetDesignStateV1['osmSnapshot'];
  osmLayerVisibility?: StreetDesignStateV1['osmLayerVisibility'];
  hiddenOsmWayIds?: string[];
  hiddenOsmFeatureIds?: string[];
  showStreetMarkings?: boolean;
  comparisonMode: StreetDesignStateV1['comparisonMode'];
  currency: string;
  costCatalogVersion: string;
}

export interface StreetDesignChangeRequestCreatePayload {
  id: string;
  amendment_id: string;
  process_branch_id: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  reason: string | null;
  source_type: 'street_design_object' | 'street_design_scene';
  source_id: string | null;
  source_title: string | null;
  change_type: StreetDesignChangeType;
  original_text: string | null;
  new_text: string | null;
  original_properties: ReadonlyJSONValue | null;
  new_properties: ReadonlyJSONValue | null;
  changed_character_count: number;
  voting_status: string;
  voting_deadline: number | null;
  voting_majority_type: string | null;
  quorum_required: number | null;
}

export interface StreetDesignChangeRequestLike {
  id: string;
  amendment_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  source_title?: string | null;
  change_type?: string | null;
  original_properties?: unknown;
  new_properties?: unknown;
}

export interface StreetDesignPersistenceSnapshot {
  design: StreetDesignStateV1;
  bbox: ReadonlyJSONValue | null;
  center_lat: number;
  center_lon: number;
  osm_snapshot: ReadonlyJSONValue | null;
  design_state: ReadonlyJSONValue;
  currency: string;
  estimated_total_cost_minor: number;
  cost_catalog_version: string;
  cost_summary: ReadonlyJSONValue;
}

const OBJECT_SOURCE_TYPE = 'street_design_object' as const;
const SCENE_SOURCE_TYPE = 'street_design_scene' as const;

export function createStreetDesignChangeRequestPayloads({
  amendmentId,
  processBranchId,
  streetDesignId,
  baseDesign,
  draftDesign,
  createId = () => crypto.randomUUID(),
}: {
  amendmentId: string;
  processBranchId?: string | null;
  streetDesignId?: string | null;
  baseDesign: StreetDesignStateV1;
  draftDesign: StreetDesignStateV1;
  createId?: () => string;
}): StreetDesignChangeRequestCreatePayload[] {
  const base = normalizeStreetDesignStateV1(baseDesign);
  const draft = normalizeStreetDesignStateV1(draftDesign);
  const baseObjects = new Map(base.objects.map(object => [object.id, object]));
  const draftObjects = new Map(draft.objects.map(object => [object.id, object]));
  const designContext = createSceneSnapshot(draft);
  const payloads: StreetDesignChangeRequestCreatePayload[] = [];

  for (const object of draft.objects) {
    const previous = baseObjects.get(object.id);
    if (!previous) {
      payloads.push(
        createObjectPayload({
          id: createId(),
          amendmentId,
          processBranchId,
          streetDesignId: streetDesignId ?? null,
          changeType: 'insert',
          previous: null,
          next: object,
          designContext,
        })
      );
      continue;
    }

    if (stableJson(previous) !== stableJson(object)) {
      payloads.push(
        createObjectPayload({
          id: createId(),
          amendmentId,
          processBranchId,
          streetDesignId: streetDesignId ?? null,
          changeType: 'update',
          previous,
          next: object,
          designContext,
        })
      );
    }
  }

  for (const object of base.objects) {
    if (draftObjects.has(object.id)) continue;
    payloads.push(
      createObjectPayload({
        id: createId(),
        amendmentId,
        processBranchId,
        streetDesignId: streetDesignId ?? null,
        changeType: 'delete',
        previous: object,
        next: null,
        designContext,
      })
    );
  }

  const baseScene = createSceneSnapshot(base);
  const draftScene = createSceneSnapshot(draft);
  if (stableJson(baseScene) !== stableJson(draftScene)) {
    const originalProperties = createSnapshot({
      streetDesignId: streetDesignId ?? null,
      objectId: null,
      scene: baseScene,
      designContext: baseScene,
    });
    const newProperties = createSnapshot({
      streetDesignId: streetDesignId ?? null,
      objectId: null,
      scene: draftScene,
      designContext: draftScene,
    });

    payloads.push({
      id: createId(),
      amendment_id: amendmentId,
      process_branch_id: processBranchId ?? null,
      title: null,
      description: 'Streetscape scene settings changed',
      status: 'open',
      reason: null,
      source_type: SCENE_SOURCE_TYPE,
      source_id: streetDesignId ?? null,
      source_title: 'Streetscape scene',
      change_type: 'update',
      original_text: summarizeSceneSnapshot(baseScene),
      new_text: summarizeSceneSnapshot(draftScene),
      original_properties: originalProperties,
      new_properties: newProperties,
      changed_character_count: countSnapshotCharacters(originalProperties, newProperties),
      voting_status: 'open',
      voting_deadline: null,
      voting_majority_type: null,
      quorum_required: null,
    });
  }

  return payloads;
}

export function applyStreetDesignChangeRequestToDesign(
  design: StreetDesignStateV1,
  changeRequest: StreetDesignChangeRequestLike
): StreetDesignStateV1 {
  const currentDesign = normalizeStreetDesignStateV1(design);
  const changeType = normalizeStreetDesignChangeType(changeRequest.change_type);

  if (changeRequest.source_type === SCENE_SOURCE_TYPE) {
    const scene = getStreetDesignSceneSnapshot(changeRequest.new_properties);
    return scene ? normalizeStreetDesignStateV1({ ...currentDesign, ...scene }) : currentDesign;
  }

  const objectId =
    changeRequest.source_id ??
    getStreetDesignObjectSnapshot(changeRequest.new_properties)?.id ??
    getStreetDesignObjectSnapshot(changeRequest.original_properties)?.id ??
    null;
  if (!objectId || !changeType) return currentDesign;

  if (changeType === 'delete') {
    return normalizeStreetDesignStateV1({
      ...currentDesign,
      objects: currentDesign.objects.filter(object => object.id !== objectId),
    });
  }

  const nextObject = getStreetDesignObjectSnapshot(changeRequest.new_properties);
  if (!nextObject) return currentDesign;

  const existingIndex = currentDesign.objects.findIndex(object => object.id === objectId);
  if (existingIndex < 0) {
    return normalizeStreetDesignStateV1({
      ...currentDesign,
      objects: [...currentDesign.objects, nextObject],
    });
  }

  return normalizeStreetDesignStateV1({
    ...currentDesign,
    objects: currentDesign.objects.map(object => (object.id === objectId ? nextObject : object)),
  });
}

export function createStreetDesignPersistenceSnapshot(
  design: StreetDesignStateV1
): StreetDesignPersistenceSnapshot {
  const normalizedDesign = normalizeStreetDesignStateV1(design);
  const costSummary = getStreetDesignCostSummary(
    normalizedDesign.objects,
    normalizedDesign.currency || STREET_DESIGN_CURRENCY
  );

  return {
    design: normalizedDesign,
    bbox: asReadonlyJsonValue(normalizedDesign.osmSnapshot?.bbox ?? null),
    center_lat: normalizedDesign.origin.lat,
    center_lon: normalizedDesign.origin.lon,
    osm_snapshot: asReadonlyJsonValue(normalizedDesign.osmSnapshot),
    design_state: asReadonlyJsonValue(normalizedDesign),
    currency: costSummary.currency,
    estimated_total_cost_minor: costSummary.totalCostMinor,
    cost_catalog_version: normalizedDesign.costCatalogVersion || STREET_DESIGN_COST_CATALOG_VERSION,
    cost_summary: asReadonlyJsonValue(costSummary),
  };
}

export function resolveStreetDesignBaseState(value: unknown, fallback?: StreetDesignStateV1) {
  return (
    parseStoredStreetDesignState(value) ??
    fallback ??
    createEmptyStreetDesignState(getStreetDesignDesignContext(value)?.origin)
  );
}

export function getStreetDesignObjectSnapshot(value: unknown): StreetDesignObject | null {
  const record = asRecord(value);
  if (!record) return null;

  const snapshotObject = asStreetDesignObject(asRecord(record.object) ?? record.object);
  if (snapshotObject) return snapshotObject;

  const direct = asStreetDesignObject(record);
  if (direct) return direct;

  return null;
}

export function getStreetDesignSceneSnapshot(value: unknown): StreetDesignSceneSnapshot | null {
  const record = asRecord(value);
  const scene = asRecord(record?.scene);
  if (!scene) return null;

  return {
    origin:
      (scene.origin as StreetDesignStateV1['origin']) ?? createEmptyStreetDesignState().origin,
    mapSelection: scene.mapSelection as StreetDesignStateV1['mapSelection'],
    osmSnapshot: (scene.osmSnapshot as StreetDesignStateV1['osmSnapshot']) ?? null,
    osmLayerVisibility: scene.osmLayerVisibility as StreetDesignStateV1['osmLayerVisibility'],
    hiddenOsmWayIds: asStringArray(scene.hiddenOsmWayIds),
    hiddenOsmFeatureIds: asStringArray(scene.hiddenOsmFeatureIds),
    showStreetMarkings:
      typeof scene.showStreetMarkings === 'boolean' ? scene.showStreetMarkings : undefined,
    comparisonMode:
      scene.comparisonMode === 'original' ||
      scene.comparisonMode === 'new_design' ||
      scene.comparisonMode === 'overlay' ||
      scene.comparisonMode === 'split'
        ? scene.comparisonMode
        : 'overlay',
    currency: typeof scene.currency === 'string' ? scene.currency : STREET_DESIGN_CURRENCY,
    costCatalogVersion:
      typeof scene.costCatalogVersion === 'string'
        ? scene.costCatalogVersion
        : STREET_DESIGN_COST_CATALOG_VERSION,
  };
}

export function getStreetDesignDesignContext(value: unknown): StreetDesignSceneSnapshot | null {
  const record = asRecord(value);
  return getStreetDesignSceneSnapshot({ scene: record?.designContext });
}

function createObjectPayload({
  id,
  amendmentId,
  processBranchId,
  streetDesignId,
  changeType,
  previous,
  next,
  designContext,
}: {
  id: string;
  amendmentId: string;
  processBranchId?: string | null;
  streetDesignId: string | null;
  changeType: StreetDesignChangeType;
  previous: StreetDesignObject | null;
  next: StreetDesignObject | null;
  designContext: StreetDesignSceneSnapshot;
}): StreetDesignChangeRequestCreatePayload {
  const object = next ?? previous;
  const objectId = object?.id ?? null;
  const objectLabel = object ? formatObjectTitle(object) : 'Streetscape object';
  const originalProperties = previous
    ? createSnapshot({ streetDesignId, objectId, object: previous, designContext })
    : null;
  const newProperties = next
    ? createSnapshot({ streetDesignId, objectId, object: next, designContext })
    : null;

  return {
    id,
    amendment_id: amendmentId,
    process_branch_id: processBranchId ?? null,
    title: null,
    description: `Streetscape object ${changeType}: ${objectLabel}`,
    status: 'open',
    reason: null,
    source_type: OBJECT_SOURCE_TYPE,
    source_id: objectId,
    source_title: objectLabel,
    change_type: changeType,
    original_text: previous ? summarizeObject(previous) : null,
    new_text: next ? summarizeObject(next) : null,
    original_properties: originalProperties,
    new_properties: newProperties,
    changed_character_count: countSnapshotCharacters(originalProperties, newProperties),
    voting_status: 'open',
    voting_deadline: null,
    voting_majority_type: null,
    quorum_required: null,
  };
}

function createSnapshot(snapshot: StreetDesignChangeRequestSnapshot): ReadonlyJSONValue {
  return asReadonlyJsonValue(snapshot);
}

function createSceneSnapshot(design: StreetDesignStateV1): StreetDesignSceneSnapshot {
  return {
    origin: design.origin,
    mapSelection: design.mapSelection,
    osmSnapshot: design.osmSnapshot,
    osmLayerVisibility: design.osmLayerVisibility,
    hiddenOsmWayIds: design.hiddenOsmWayIds,
    hiddenOsmFeatureIds: design.hiddenOsmFeatureIds,
    showStreetMarkings: design.showStreetMarkings,
    comparisonMode: design.comparisonMode,
    currency: design.currency,
    costCatalogVersion: design.costCatalogVersion,
  };
}

function normalizeStreetDesignChangeType(value: string | null | undefined) {
  if (value === 'add') return 'insert';
  if (value === 'remove') return 'delete';
  if (value === 'insert' || value === 'update' || value === 'delete') return value;
  return null;
}

function formatObjectTitle(object: StreetDesignObject) {
  return `${object.type} ${object.id.slice(0, 8)}`;
}

function summarizeObject(object: StreetDesignObject) {
  return `${object.type} ${object.id}`;
}

function summarizeSceneSnapshot(snapshot: StreetDesignSceneSnapshot) {
  const featureCount =
    snapshot.osmSnapshot?.features?.length ?? snapshot.osmSnapshot?.ways?.length ?? 0;
  return `origin ${snapshot.origin.lat.toFixed(6)}, ${snapshot.origin.lon.toFixed(6)}; ${featureCount} OSM features`;
}

function countSnapshotCharacters(
  before: ReadonlyJSONValue | null,
  after: ReadonlyJSONValue | null
) {
  return stableJson(before).length + stableJson(after).length;
}

function asStreetDesignObject(value: unknown): StreetDesignObject | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== 'string' || typeof record.type !== 'string') return null;
  if (!asRecord(record.geometry)) return null;
  return record as unknown as StreetDesignObject;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : undefined;
}

function asReadonlyJsonValue(value: unknown): ReadonlyJSONValue {
  return value as ReadonlyJSONValue;
}

function stableJson(value: unknown) {
  return JSON.stringify(value, Object.keys(flattenKeys(value)).sort());
}

function flattenKeys(value: unknown, keys: Record<string, true> = {}) {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    value.forEach(item => flattenKeys(item, keys));
    return keys;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    keys[key] = true;
    flattenKeys(entry, keys);
  });
  return keys;
}

import { toMutableJSONValue, type MutableJSONValue } from '@/zero/shared/helpers';
import type { CityDesignObject, CityDesignStateV1 } from '../types';
import { getCityDesignCostLine, getCityDesignCostSummary } from './cityDesignCosting';
import { formatCurrencyMinorAudit } from '@/features/shared/logic/currency';
import { translate } from '@/features/shared/hooks/use-translation';
import { CITY_DESIGN_COST_CATALOG_VERSION, CITY_DESIGN_CURRENCY } from './cityDesignObjectRegistry';
import {
  createEmptyCityDesignState,
  normalizeCityDesignStateV1,
  parseStoredCityDesignState,
} from '../state/cityDesignReducer';

export type CityDesignChangeType = 'insert' | 'update' | 'delete';

export interface CityDesignChangeRequestSnapshot {
  cityDesignId: string | null;
  objectId: string | null;
  object?: CityDesignObject;
  scene?: CityDesignSceneSnapshot;
  designContext?: CityDesignSceneSnapshot;
}

export interface CityDesignSceneSnapshot {
  origin: CityDesignStateV1['origin'];
  mapSelection?: CityDesignStateV1['mapSelection'];
  osmSnapshot: CityDesignStateV1['osmSnapshot'];
  osmLayerVisibility?: CityDesignStateV1['osmLayerVisibility'];
  hiddenOsmWayIds?: string[];
  hiddenOsmFeatureIds?: string[];
  showStreetMarkings?: boolean;
  comparisonMode: CityDesignStateV1['comparisonMode'];
  currency: string;
  costCatalogVersion: string;
}

export interface CityDesignChangeRequestCreatePayload {
  id: string;
  amendment_id: string;
  process_branch_id: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  reason: string | null;
  source_type: 'city_design_object' | 'city_design_scene';
  source_id: string | null;
  source_title: string | null;
  change_type: CityDesignChangeType;
  original_text: string | null;
  new_text: string | null;
  original_properties: MutableJSONValue | null;
  new_properties: MutableJSONValue | null;
  changed_character_count: number;
  voting_status: string;
  voting_deadline: number | null;
  voting_majority_type: string | null;
  quorum_required: number | null;
}

export interface CityDesignChangeRequestLike {
  id: string;
  amendment_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  source_title?: string | null;
  change_type?: string | null;
  original_properties?: unknown;
  new_properties?: unknown;
}

export interface CityDesignPersistenceSnapshot {
  design: CityDesignStateV1;
  bbox: MutableJSONValue | null;
  center_lat: number;
  center_lon: number;
  osm_snapshot: MutableJSONValue | null;
  design_state: MutableJSONValue;
  currency: string;
  estimated_total_cost_minor: number;
  cost_catalog_version: string;
  cost_summary: MutableJSONValue;
}

export interface CityDesignCostChange {
  beforeUnitCostMinor: number | null;
  afterUnitCostMinor: number | null;
  beforeTotalCostMinor: number | null;
  afterTotalCostMinor: number | null;
}

const OBJECT_SOURCE_TYPE = 'city_design_object' as const;
const SCENE_SOURCE_TYPE = 'city_design_scene' as const;

export function createCityDesignChangeRequestPayloads({
  amendmentId,
  processBranchId,
  cityDesignId,
  baseDesign,
  draftDesign,
  createId = () => crypto.randomUUID(),
}: {
  amendmentId: string;
  processBranchId?: string | null;
  cityDesignId?: string | null;
  baseDesign: CityDesignStateV1;
  draftDesign: CityDesignStateV1;
  createId?: () => string;
}): CityDesignChangeRequestCreatePayload[] {
  const base = normalizeCityDesignStateV1(baseDesign);
  const draft = normalizeCityDesignStateV1(draftDesign);
  const baseObjects = new Map(base.objects.map(object => [object.id, object]));
  const draftObjects = new Map(draft.objects.map(object => [object.id, object]));
  const designContext = createSceneSnapshot(draft);
  const payloads: CityDesignChangeRequestCreatePayload[] = [];

  for (const object of draft.objects) {
    const previous = baseObjects.get(object.id);
    if (!previous) {
      payloads.push(
        createObjectPayload({
          id: createId(),
          amendmentId,
          processBranchId,
          cityDesignId: cityDesignId ?? null,
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
          cityDesignId: cityDesignId ?? null,
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
        cityDesignId: cityDesignId ?? null,
        changeType: 'delete',
        previous: object,
        next: null,
        designContext,
      })
    );
  }

  return payloads;
}

export function applyCityDesignChangeRequestToDesign(
  design: CityDesignStateV1,
  changeRequest: CityDesignChangeRequestLike
): CityDesignStateV1 {
  const currentDesign = normalizeCityDesignStateV1(design);
  const changeType = normalizeCityDesignChangeType(changeRequest.change_type);

  if (changeRequest.source_type === SCENE_SOURCE_TYPE) {
    const scene = getCityDesignSceneSnapshot(changeRequest.new_properties);
    return scene ? normalizeCityDesignStateV1({ ...currentDesign, ...scene }) : currentDesign;
  }

  const objectId =
    changeRequest.source_id ??
    getCityDesignObjectSnapshot(changeRequest.new_properties)?.id ??
    getCityDesignObjectSnapshot(changeRequest.original_properties)?.id ??
    null;
  if (!objectId || !changeType) return currentDesign;

  if (changeType === 'delete') {
    return normalizeCityDesignStateV1({
      ...currentDesign,
      objects: currentDesign.objects.filter(object => object.id !== objectId),
    });
  }

  const nextObject = getCityDesignObjectSnapshot(changeRequest.new_properties);
  if (!nextObject) return currentDesign;

  const existingIndex = currentDesign.objects.findIndex(object => object.id === objectId);
  if (existingIndex < 0) {
    return normalizeCityDesignStateV1({
      ...currentDesign,
      objects: [...currentDesign.objects, nextObject],
    });
  }

  const originalObject = getCityDesignObjectSnapshot(changeRequest.original_properties);
  const currentObject = currentDesign.objects[existingIndex];
  const mergedObject = originalObject
    ? (applySemanticChangePatch(currentObject, originalObject, nextObject) as CityDesignObject)
    : nextObject;

  return normalizeCityDesignStateV1({
    ...currentDesign,
    objects: currentDesign.objects.map(object => (object.id === objectId ? mergedObject : object)),
  });
}

export function getCityDesignSemanticChangedCharacterCount(before: unknown, after: unknown) {
  const beforeComparable = getSemanticSnapshotValue(before);
  const afterComparable = getSemanticSnapshotValue(after);
  return countChangedValueCharacters(beforeComparable, afterComparable);
}

export function getCityDesignCostChange(
  originalProperties: unknown,
  newProperties: unknown
): CityDesignCostChange | null {
  const before = getCityDesignObjectSnapshot(originalProperties);
  const after = getCityDesignObjectSnapshot(newProperties);
  if (!before && !after) return null;

  return {
    beforeUnitCostMinor: before ? getEffectiveUnitCostMinor(before) : null,
    afterUnitCostMinor: after ? getEffectiveUnitCostMinor(after) : null,
    beforeTotalCostMinor: before ? getCityDesignCostLine(before).totalCostMinor : null,
    afterTotalCostMinor: after ? getCityDesignCostLine(after).totalCostMinor : null,
  };
}

export function createCityDesignPersistenceSnapshot(
  design: CityDesignStateV1
): CityDesignPersistenceSnapshot {
  const normalizedDesign = normalizeCityDesignStateV1(design);
  const costSummary = getCityDesignCostSummary(
    normalizedDesign.objects,
    normalizedDesign.currency || CITY_DESIGN_CURRENCY
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
    cost_catalog_version: normalizedDesign.costCatalogVersion || CITY_DESIGN_COST_CATALOG_VERSION,
    cost_summary: asReadonlyJsonValue(costSummary),
  };
}

export function resolveCityDesignBaseState(value: unknown, fallback?: CityDesignStateV1) {
  return (
    parseStoredCityDesignState(value) ??
    fallback ??
    createEmptyCityDesignState(getCityDesignDesignContext(value)?.origin)
  );
}

export function getCityDesignObjectSnapshot(value: unknown): CityDesignObject | null {
  const record = asRecord(value);
  if (!record) return null;

  const snapshotObject = asCityDesignObject(asRecord(record.object) ?? record.object);
  if (snapshotObject) return snapshotObject;

  const direct = asCityDesignObject(record);
  if (direct) return direct;

  return null;
}

export function getCityDesignSceneSnapshot(value: unknown): CityDesignSceneSnapshot | null {
  const record = asRecord(value);
  const scene = asRecord(record?.scene);
  if (!scene) return null;

  return {
    origin: (scene.origin as CityDesignStateV1['origin']) ?? createEmptyCityDesignState().origin,
    mapSelection: scene.mapSelection as CityDesignStateV1['mapSelection'],
    osmSnapshot: (scene.osmSnapshot as CityDesignStateV1['osmSnapshot']) ?? null,
    osmLayerVisibility: scene.osmLayerVisibility as CityDesignStateV1['osmLayerVisibility'],
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
    currency: typeof scene.currency === 'string' ? scene.currency : CITY_DESIGN_CURRENCY,
    costCatalogVersion:
      typeof scene.costCatalogVersion === 'string'
        ? scene.costCatalogVersion
        : CITY_DESIGN_COST_CATALOG_VERSION,
  };
}

export function getCityDesignDesignContext(value: unknown): CityDesignSceneSnapshot | null {
  const record = asRecord(value);
  return getCityDesignSceneSnapshot({ scene: record?.designContext });
}

function createObjectPayload({
  id,
  amendmentId,
  processBranchId,
  cityDesignId,
  changeType,
  previous,
  next,
  designContext,
}: {
  id: string;
  amendmentId: string;
  processBranchId?: string | null;
  cityDesignId: string | null;
  changeType: CityDesignChangeType;
  previous: CityDesignObject | null;
  next: CityDesignObject | null;
  designContext: CityDesignSceneSnapshot;
}): CityDesignChangeRequestCreatePayload {
  const object = next ?? previous;
  const objectId = object?.id ?? null;
  const objectLabel = object
    ? formatObjectTitle(object)
    : translate('features.amendments.cityDesign.changeRequests.objectFallback');
  const originalProperties = previous
    ? createSnapshot({ cityDesignId, objectId, object: previous, designContext })
    : null;
  const newProperties = next
    ? createSnapshot({ cityDesignId, objectId, object: next, designContext })
    : null;

  const isPriceOnlyUpdate = Boolean(previous && next && isOnlyObjectCostChanged(previous, next));

  return {
    id,
    amendment_id: amendmentId,
    process_branch_id: processBranchId ?? null,
    title: null,
    description: isPriceOnlyUpdate
      ? translate('features.amendments.cityDesign.changeRequests.unitPriceChanged', {
          object: objectLabel,
        })
      : translate('features.amendments.cityDesign.changeRequests.objectChanged', {
          changeType,
          object: objectLabel,
        }),
    status: 'open',
    reason: null,
    source_type: OBJECT_SOURCE_TYPE,
    source_id: objectId,
    source_title: objectLabel,
    change_type: changeType,
    original_text: previous
      ? isPriceOnlyUpdate
        ? summarizeObjectUnitPrice(previous)
        : summarizeObject(previous)
      : null,
    new_text: next
      ? isPriceOnlyUpdate
        ? summarizeObjectUnitPrice(next)
        : summarizeObject(next)
      : null,
    original_properties: originalProperties,
    new_properties: newProperties,
    changed_character_count: getCityDesignSemanticChangedCharacterCount(
      originalProperties,
      newProperties
    ),
    voting_status: 'open',
    voting_deadline: null,
    voting_majority_type: null,
    quorum_required: null,
  };
}

function createSnapshot(snapshot: CityDesignChangeRequestSnapshot): MutableJSONValue {
  return asReadonlyJsonValue(snapshot);
}

function createSceneSnapshot(design: CityDesignStateV1): CityDesignSceneSnapshot {
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

function normalizeCityDesignChangeType(value: string | null | undefined) {
  if (value === 'add') return 'insert';
  if (value === 'remove') return 'delete';
  if (value === 'insert' || value === 'update' || value === 'delete') return value;
  return null;
}

function formatObjectTitle(object: CityDesignObject) {
  return `${object.type} ${object.id.slice(0, 8)}`;
}

function summarizeObject(object: CityDesignObject) {
  return `${object.type} ${object.id}`;
}

function summarizeObjectUnitPrice(object: CityDesignObject) {
  return translate('features.amendments.cityDesign.changeRequests.unitPrice', {
    price: formatCurrencyMinorAudit(getEffectiveUnitCostMinor(object), object.cost.currency),
  });
}

function getEffectiveUnitCostMinor(object: CityDesignObject) {
  return object.cost.customUnitCostMinor ?? object.cost.suggestedUnitCostMinor;
}

function isOnlyObjectCostChanged(before: CityDesignObject, after: CityDesignObject) {
  const withoutCost = (object: CityDesignObject) => {
    const { cost, ...rest } = object;
    void cost;
    return rest;
  };
  return (
    stableJson(withoutCost(before)) === stableJson(withoutCost(after)) &&
    stableJson(before.cost) !== stableJson(after.cost)
  );
}

function getSemanticSnapshotValue(value: unknown) {
  const object = getCityDesignObjectSnapshot(value);
  if (object) return object;
  const scene = getCityDesignSceneSnapshot(value);
  return scene;
}

function countChangedValueCharacters(before: unknown, after: unknown): number {
  if (stableJson(before) === stableJson(after)) return 0;

  if (isPlainRecord(before) && isPlainRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    let count = 0;
    for (const key of keys) {
      const childCount = countChangedValueCharacters(before[key], after[key]);
      if (childCount > 0) count += key.length + childCount;
    }
    return count;
  }

  return stableJson(before).length + stableJson(after).length;
}

function applySemanticChangePatch(current: unknown, before: unknown, after: unknown): unknown {
  if (stableJson(before) === stableJson(after)) return current;

  if (isPlainRecord(before) && isPlainRecord(after)) {
    const result: Record<string, unknown> = isPlainRecord(current) ? { ...current } : {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const beforeHasKey = Object.prototype.hasOwnProperty.call(before, key);
      const afterHasKey = Object.prototype.hasOwnProperty.call(after, key);
      if (beforeHasKey && !afterHasKey) {
        Reflect.deleteProperty(result, key);
        continue;
      }
      result[key] = applySemanticChangePatch(result[key], before[key], after[key]);
    }
    return result;
  }

  return after;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asCityDesignObject(value: unknown): CityDesignObject | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== 'string' || typeof record.type !== 'string') return null;
  if (!asRecord(record.geometry)) return null;
  return record as unknown as CityDesignObject;
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

function asReadonlyJsonValue(value: unknown): MutableJSONValue {
  return toMutableJSONValue(value);
}

function stableJson(value: unknown) {
  return JSON.stringify(value, Object.keys(flattenKeys(value)).sort()) ?? 'undefined';
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

export const cityDesignChangeRequestDiffInternals = {
  applySemanticChangePatch,
  asCityDesignObject,
  asRecord,
  asStringArray,
  countChangedValueCharacters,
  createObjectPayload,
  flattenKeys,
  getEffectiveUnitCostMinor,
  getSemanticSnapshotValue,
  isOnlyObjectCostChanged,
  isPlainRecord,
  normalizeCityDesignChangeType,
  stableJson,
};

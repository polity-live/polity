import { getCityDesignSemanticChangedCharacterCount } from '@/features/amendments/city-design/logic/cityDesignChangeRequestDiff';

export const CHANGE_REQUEST_VOTE_ORDER_VALUES = [
  'text_position',
  'changed_character_count',
  'cr_number',
] as const;

export type ChangeRequestVoteOrder = (typeof CHANGE_REQUEST_VOTE_ORDER_VALUES)[number];

export const DEFAULT_CHANGE_REQUEST_VOTE_ORDER: ChangeRequestVoteOrder = 'text_position';

const CHANGE_REQUEST_VOTE_ORDER_SET = new Set<string>(CHANGE_REQUEST_VOTE_ORDER_VALUES);

const changeRequestSortCollator = new Intl.Collator(undefined, {
  numeric: false,
  sensitivity: 'base',
});

export function normalizeChangeRequestVoteOrder(value: unknown): ChangeRequestVoteOrder {
  return typeof value === 'string' && CHANGE_REQUEST_VOTE_ORDER_SET.has(value)
    ? (value as ChangeRequestVoteOrder)
    : DEFAULT_CHANGE_REQUEST_VOTE_ORDER;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getNumberValue(value: unknown, options: { positiveOnly?: boolean } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (options.positiveOnly && value <= 0) return null;
  return Math.floor(value);
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getTimestampValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractLastNumber(pattern: RegExp, values: unknown[]) {
  for (const value of values) {
    const text = getStringValue(value);
    if (!text) continue;

    let result: number | null = null;
    pattern.lastIndex = 0;
    for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) {
        result = parsed;
      }
    }

    if (result !== null) {
      return result;
    }
  }

  return null;
}

function readChangeRequest<T>(
  item: T,
  getChangeRequest?: (item: T) => unknown
): Record<string, unknown> {
  const explicit = getChangeRequest?.(item);
  if (isRecord(explicit)) return explicit;
  if (isRecord(item) && isRecord(item.change_request)) return item.change_request;
  return isRecord(item) ? item : {};
}

function getChangeRequestSortText<T>(item: T, getChangeRequest?: (item: T) => unknown) {
  const row: Record<string, unknown> = isRecord(item) ? item : {};
  const cr = readChangeRequest(item, getChangeRequest);

  return (
    getStringValue(cr.display_cr_id) ??
    getStringValue(cr.displayCrId) ??
    getStringValue(cr.cr_id) ??
    getStringValue(cr.crId) ??
    getStringValue(cr.title) ??
    getStringValue(row.change_request_id) ??
    getStringValue(row.id) ??
    ''
  );
}

function getChangeRequestSortNumber<T>(item: T, getChangeRequest?: (item: T) => unknown) {
  const row: Record<string, unknown> = isRecord(item) ? item : {};
  const cr = readChangeRequest(item, getChangeRequest);

  return (
    getNumberValue(cr.branch_scoped_cr_number, { positiveOnly: true }) ??
    getNumberValue(cr.branchScopedCrNumber, { positiveOnly: true }) ??
    getNumberValue(cr.branch_sequence_number, { positiveOnly: true }) ??
    getNumberValue(cr.branchSequenceNumber, { positiveOnly: true }) ??
    extractLastNumber(/\bCR-(\d+)\b/gi, [
      cr.display_cr_id,
      cr.displayCrId,
      cr.cr_id,
      cr.crId,
      cr.title,
      row.change_request_id,
      row.id,
    ])
  );
}

function getBranchSortNumber<T>(item: T, getChangeRequest?: (item: T) => unknown) {
  const cr = readChangeRequest(item, getChangeRequest);

  return (
    getNumberValue(cr.branch_display_number, { positiveOnly: true }) ??
    getNumberValue(cr.branchDisplayNumber, { positiveOnly: true }) ??
    extractLastNumber(/\bBranch\s+(\d+)\b/gi, [cr.display_cr_id, cr.displayCrId, cr.title])
  );
}

function getChangedCharacterCount<T>(item: T, getChangeRequest?: (item: T) => unknown) {
  const cr = readChangeRequest(item, getChangeRequest);
  if (isCityDesignChangeRequestRecord(cr)) {
    return getCityDesignSemanticChangedCharacterCount(
      cr.original_properties ?? cr.originalProperties,
      cr.new_properties ?? cr.newProperties
    );
  }
  const persistedCount =
    getNumberValue(cr.changed_character_count) ?? getNumberValue(cr.changedCharacterCount);
  const computedCount = getSnapshotChangedCharacterCount(cr);
  if (persistedCount !== null && persistedCount > 0) return persistedCount;
  if (computedCount > 0) return computedCount;
  return persistedCount ?? computedCount;
}

function isCityDesignChangeRequestRecord(cr: Record<string, unknown>) {
  const sourceType = getStringValue(cr.source_type) ?? getStringValue(cr.sourceType);
  return Boolean(sourceType && sourceType.startsWith('city_design_'));
}

function countPropertyCharacters(value: unknown) {
  if (!isRecord(value)) return 0;

  return Object.entries(value).reduce((sum, [key, propertyValue]) => {
    if (propertyValue == null) return sum + key.length;
    return sum + key.length + String(propertyValue).length;
  }, 0);
}

function getSnapshotChangedCharacterCount(cr: Record<string, unknown>) {
  const originalText = getStringValue(cr.original_text) ?? getStringValue(cr.originalText) ?? '';
  const newText = getStringValue(cr.new_text) ?? getStringValue(cr.newText) ?? '';
  const propertyCharacters =
    countPropertyCharacters(cr.original_properties) +
    countPropertyCharacters(cr.originalProperties) +
    countPropertyCharacters(cr.new_properties) +
    countPropertyCharacters(cr.newProperties);

  return originalText.length + newText.length + propertyCharacters;
}

function getCreatedAt<T>(item: T, getChangeRequest?: (item: T) => unknown) {
  const row: Record<string, unknown> = isRecord(item) ? item : {};
  const cr = readChangeRequest(item, getChangeRequest);
  return (
    getTimestampValue(cr.created_at) ??
    getTimestampValue(cr.createdAt) ??
    getTimestampValue(row.created_at)
  );
}

function compareNullableNumbers(left: number | null, right: number | null) {
  if (left !== null && right === null) return -1;
  if (left === null && right !== null) return 1;
  if (left !== null && right !== null && left !== right) return left - right;
  return 0;
}

function compareNumbersDescending(left: number, right: number) {
  return right - left;
}

function compareCrNumber<T>(left: T, right: T, getChangeRequest?: (item: T) => unknown) {
  const branchDiff = compareNullableNumbers(
    getBranchSortNumber(left, getChangeRequest),
    getBranchSortNumber(right, getChangeRequest)
  );
  if (branchDiff !== 0) return branchDiff;

  const numberDiff = compareNullableNumbers(
    getChangeRequestSortNumber(left, getChangeRequest),
    getChangeRequestSortNumber(right, getChangeRequest)
  );
  if (numberDiff !== 0) return numberDiff;

  return compareNullableNumbers(
    getCreatedAt(left, getChangeRequest),
    getCreatedAt(right, getChangeRequest)
  );
}

export function buildSuggestionDocumentOrder(documentContent: unknown) {
  const suggestionOrder = new Map<string, number>();
  if (!Array.isArray(documentContent)) return suggestionOrder;

  let nodeIndex = 0;

  const visitNodes = (nodes: readonly unknown[]): void => {
    for (const node of nodes) {
      const currentIndex = nodeIndex;
      nodeIndex += 1;

      if (!isRecord(node)) continue;

      for (const key of Object.keys(node)) {
        if (!key.startsWith('suggestion_')) continue;

        const suggestionData = node[key];
        if (!isRecord(suggestionData)) continue;

        const suggestionId = getStringValue(suggestionData.id);
        if (suggestionId && !suggestionOrder.has(suggestionId)) {
          suggestionOrder.set(suggestionId, currentIndex);
        }
      }

      const children = node.children;
      if (Array.isArray(children)) {
        visitNodes(children);
      }
    }
  };

  visitNodes(documentContent);
  return suggestionOrder;
}

export function sortChangeRequestsByVoteOrder<T>(
  items: readonly T[],
  voteOrder: ChangeRequestVoteOrder,
  options: {
    getChangeRequest?: (item: T) => unknown;
    getSuggestionId?: (item: T, changeRequest: unknown) => string | null | undefined;
    getTextPosition?: (item: T, changeRequest: unknown) => number | null | undefined;
    suggestionDocumentOrder?: ReadonlyMap<string, number>;
  } = {}
) {
  const normalizedVoteOrder = normalizeChangeRequestVoteOrder(voteOrder);

  const getDocumentPosition = (item: T) => {
    const cr = readChangeRequest(item, options.getChangeRequest);
    const explicitPosition = options.getTextPosition?.(item, cr);
    if (typeof explicitPosition === 'number' && Number.isFinite(explicitPosition)) {
      return explicitPosition;
    }

    const suggestionId = options.getSuggestionId?.(item, cr);
    if (!suggestionId || !options.suggestionDocumentOrder) return null;
    return options.suggestionDocumentOrder.get(suggestionId) ?? null;
  };

  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (normalizedVoteOrder === 'text_position') {
        const leftCr = readChangeRequest(left.item, options.getChangeRequest);
        const rightCr = readChangeRequest(right.item, options.getChangeRequest);
        const leftPosition = getDocumentPosition(left.item);
        const rightPosition = getDocumentPosition(right.item);
        const documentOrderDiff = compareNullableNumbers(leftPosition, rightPosition);
        if (documentOrderDiff !== 0) return documentOrderDiff;

        if (leftPosition === null && rightPosition === null) {
          const leftIsCityDesign = isCityDesignChangeRequestRecord(leftCr);
          const rightIsCityDesign = isCityDesignChangeRequestRecord(rightCr);
          if (leftIsCityDesign !== rightIsCityDesign) return leftIsCityDesign ? 1 : -1;
          if (leftIsCityDesign && rightIsCityDesign) {
            const numberDiff = compareCrNumber(left.item, right.item, options.getChangeRequest);
            if (numberDiff !== 0) return numberDiff;
          }
        }
      }

      if (normalizedVoteOrder === 'changed_character_count') {
        const characterCountDiff = compareNumbersDescending(
          getChangedCharacterCount(left.item, options.getChangeRequest),
          getChangedCharacterCount(right.item, options.getChangeRequest)
        );
        if (characterCountDiff !== 0) return characterCountDiff;

        const createdAtDiff = compareNullableNumbers(
          getCreatedAt(left.item, options.getChangeRequest),
          getCreatedAt(right.item, options.getChangeRequest)
        );
        if (createdAtDiff !== 0) return createdAtDiff;
      }

      if (normalizedVoteOrder === 'cr_number') {
        const numberDiff = compareCrNumber(left.item, right.item, options.getChangeRequest);
        if (numberDiff !== 0) return numberDiff;
      }

      const labelDiff = changeRequestSortCollator.compare(
        getChangeRequestSortText(left.item, options.getChangeRequest),
        getChangeRequestSortText(right.item, options.getChangeRequest)
      );
      if (labelDiff !== 0) return labelDiff;

      return left.index - right.index;
    })
    .map(entry => entry.item);
}

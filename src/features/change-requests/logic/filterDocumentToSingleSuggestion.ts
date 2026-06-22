/**
 * Pure function that strips all suggestion marks from a plate-js document
 * EXCEPT those belonging to the specified suggestion IDs.
 *
 * Used for the editor preview inside CR cards:
 * the document shows the current state of the text with only the chosen
 * suggestions highlighted, so the user can focus on those specific changes.
 */
import type { Value, Descendant } from 'platejs';

export type SuggestionPreviewResolution = 'accept' | 'reject';
export type SuggestionPreviewResolutionMap = ReadonlyMap<string, SuggestionPreviewResolution>;

interface SuggestionMark {
  id?: string;
  type?: string;
  properties?: Record<string, unknown>;
  newProperties?: Record<string, unknown>;
}

/**
 * Filter a plate-js document to only show the specified suggestions.
 *
 * All other suggestion marks are "resolved" in their reject direction
 * (i.e. inserted text from other suggestions is removed,
 *  removed text from other suggestions is kept without the mark).
 * The target suggestions are left intact with their marks.
 *
 * @param content - The plate-js document JSON
 * @param targetSuggestionIds - The suggestion IDs to keep
 * @returns A new document Value with only the target suggestions' marks
 */
export function filterDocumentToSuggestions(
  content: Value,
  targetSuggestionIds: Set<string>,
  suggestionResolutions?: SuggestionPreviewResolutionMap
): Value {
  return processNodes(content, targetSuggestionIds, suggestionResolutions) as Value;
}

function processNodes(
  nodes: Descendant[],
  targetIds: Set<string>,
  suggestionResolutions?: SuggestionPreviewResolutionMap
): Descendant[] {
  const result: Descendant[] = [];

  for (const node of nodes) {
    const processed = processNode(node, targetIds, suggestionResolutions);
    result.push(...processed);
  }

  return result;
}

function processNode(
  node: Descendant,
  targetIds: Set<string>,
  suggestionResolutions?: SuggestionPreviewResolutionMap
): Descendant[] {
  const allSuggestionKeys = findAllSuggestionKeys(node);

  if (allSuggestionKeys.length === 0) {
    // Not a suggestion node — recurse into children
    if ('children' in node && Array.isArray(node.children)) {
      const processedChildren = processNodes(node.children, targetIds, suggestionResolutions);
      return [{ ...node, children: processedChildren }];
    }
    return [node];
  }

  const otherKeys = allSuggestionKeys.filter(key => {
    const mark = (node as Record<string, unknown>)[key] as SuggestionMark;
    return !targetIds.has(mark?.id ?? '');
  });

  let cleaned = { ...node } as Record<string, unknown>;
  for (const otherKey of otherKeys) {
    const resolved = resolveSuggestion(cleaned, otherKey, suggestionResolutions);
    if (!resolved) {
      return [];
    }
    cleaned = resolved;
  }

  if ('children' in cleaned && Array.isArray(cleaned.children)) {
    cleaned.children = processNodes(
      cleaned.children as Descendant[],
      targetIds,
      suggestionResolutions
    );
  }

  return [stripSuggestionFlagIfResolved(cleaned) as Descendant];
}

function resolveSuggestion(
  node: Record<string, unknown>,
  suggestionKey: string,
  suggestionResolutions?: SuggestionPreviewResolutionMap
): Record<string, unknown> | null {
  const mark = node[suggestionKey] as SuggestionMark;
  const type = mark?.type;
  const action = suggestionResolutions?.get(mark?.id ?? '') ?? 'reject';

  if (action === 'accept') {
    if (type === 'insert') {
      return stripSuggestionMark(node, suggestionKey);
    }

    if (type === 'replace') {
      return stripSuggestionMark(node, suggestionKey);
    }

    if (type === 'remove') {
      return null;
    }

    if (type === 'update') {
      const cleaned = stripSuggestionMark(node, suggestionKey);
      if (mark?.newProperties) {
        return { ...cleaned, ...mark.newProperties };
      }
      return cleaned;
    }

    return stripSuggestionMark(node, suggestionKey);
  }

  if (type === 'insert') {
    return null;
  }

  if (type === 'replace') {
    return null;
  }

  if (type === 'remove') {
    return stripSuggestionMark(node, suggestionKey);
  }

  if (type === 'update') {
    const cleaned = stripSuggestionMark(node, suggestionKey);
    if (mark?.properties) {
      return { ...cleaned, ...mark.properties };
    }
    return cleaned;
  }

  return stripSuggestionMark(node, suggestionKey);
}

function stripSuggestionMark(
  node: Record<string, unknown>,
  suggestionKey: string
): Record<string, unknown> {
  const cleaned = { ...node };
  Reflect.deleteProperty(cleaned, suggestionKey);
  return stripSuggestionFlagIfResolved(cleaned);
}

function stripSuggestionFlagIfResolved(node: Record<string, unknown>): Record<string, unknown> {
  const hasSuggestionMarks = Object.keys(node).some(key => key.startsWith('suggestion_'));
  if (!hasSuggestionMarks) {
    Reflect.deleteProperty(node, 'suggestion');
  }
  return node;
}

function findAllSuggestionKeys(node: Descendant): string[] {
  if (!node || typeof node !== 'object') return [];
  return Object.keys(node).filter(k => k.startsWith('suggestion_'));
}

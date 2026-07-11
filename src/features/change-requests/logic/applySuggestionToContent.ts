/**
 * Pure function to apply or reject a plate-js suggestion in document content.
 *
 * Walks the document tree, finds nodes with `suggestion_<key>` marks matching
 * the given suggestion ID, and:
 * - accept: keeps the suggested text/formatting, removes the suggestion mark
 * - reject: reverts to original text, removes the suggestion mark
 */
import type { Value, Descendant } from 'platejs';

type SuggestionAction = 'accept' | 'reject';

interface SuggestionMark {
  id?: string;
  type?: string;
  properties?: Record<string, unknown>;
  newProperties?: Record<string, unknown>;
}

export interface ResolvedSuggestionDecision {
  suggestion_id?: string | null;
  status?: string | null;
  voting_status?: string | null;
  created_at?: number | null;
}

/**
 * Apply or reject a specific suggestion in a plate-js document.
 *
 * @param content - The plate-js document JSON (Value = Descendant[])
 * @param suggestionId - The discussion/suggestion ID to process
 * @param action - 'accept' keeps the change, 'reject' reverts it
 * @returns A new document Value with the suggestion processed
 */
export function applySuggestionToContent(
  content: Value,
  suggestionId: string,
  action: SuggestionAction
): Value {
  return processNodes(content, suggestionId, action) as Value;
}

export function applyResolvedSuggestionsToContent(
  content: Value,
  changeRequests: readonly ResolvedSuggestionDecision[]
): Value {
  return [...changeRequests]
    .filter(
      changeRequest =>
        changeRequest.voting_status === 'completed' &&
        Boolean(changeRequest.suggestion_id) &&
        ['accepted', 'approved', 'rejected', 'declined'].includes(changeRequest.status ?? '')
    )
    .sort((left, right) => (left.created_at ?? 0) - (right.created_at ?? 0))
    .reduce((nextContent, changeRequest) => {
      const suggestionId = changeRequest.suggestion_id;
      if (!suggestionId) return nextContent;

      return applySuggestionToContent(
        nextContent,
        suggestionId,
        changeRequest.status === 'accepted' || changeRequest.status === 'approved'
          ? 'accept'
          : 'reject'
      );
    }, content);
}

function processNodes(
  nodes: Descendant[],
  suggestionId: string,
  action: SuggestionAction
): Descendant[] {
  const result: Descendant[] = [];

  for (const node of nodes) {
    const processed = processNode(node, suggestionId, action);
    result.push(...processed);
  }

  return result;
}

function processNode(
  node: Descendant,
  suggestionId: string,
  action: SuggestionAction
): Descendant[] {
  const blockSuggestion = findBlockSuggestion(node, suggestionId);
  if (blockSuggestion) {
    const resolvedBlock = resolveBlockSuggestion(node, blockSuggestion, action);
    return resolvedBlock ? processNode(resolvedBlock, suggestionId, action) : [];
  }

  // Check if this is a text node with suggestion marks
  const suggestionKey = findSuggestionKey(node, suggestionId);

  if (suggestionKey) {
    const mark = (node as Record<string, unknown>)[suggestionKey] as SuggestionMark;
    const suggestionType = mark?.type;

    if (suggestionType === 'insert') {
      if (action === 'accept') {
        // Keep the text, remove the suggestion mark
        return [stripSuggestionMark(node, suggestionKey)];
      }
      // Reject: remove the inserted text entirely
      return [];
    }

    if (suggestionType === 'remove') {
      if (action === 'accept') {
        // Accept removal: remove the text
        return [];
      }
      // Reject removal: keep the text, remove the suggestion mark
      return [stripSuggestionMark(node, suggestionKey)];
    }

    if (suggestionType === 'replace') {
      if (action === 'accept') {
        // Keep the replacement text, remove the mark
        return [stripSuggestionMark(node, suggestionKey)];
      }
      // Reject: remove the replacement text (original is elsewhere)
      return [];
    }

    if (suggestionType === 'update') {
      if (action === 'accept') {
        // Apply the new properties, remove the suggestion mark
        const cleaned = stripSuggestionMark(node, suggestionKey);
        if (mark?.newProperties) {
          return [{ ...cleaned, ...mark.newProperties }];
        }
        return [cleaned];
      }
      // Reject: keep original properties, remove the suggestion mark
      const cleaned = stripSuggestionMark(node, suggestionKey);
      if (mark?.properties) {
        return [{ ...cleaned, ...mark.properties }];
      }
      return [cleaned];
    }

    // Unknown type: just strip the mark
    return [stripSuggestionMark(node, suggestionKey)];
  }

  // Not a suggestion node — recurse into children
  if ('children' in node && Array.isArray(node.children)) {
    const processedChildren = processNodes(node.children, suggestionId, action);
    return [{ ...node, children: processedChildren }];
  }

  return [node];
}

function findBlockSuggestion(node: Descendant, suggestionId: string): SuggestionMark | null {
  if (!node || typeof node !== 'object' || !('suggestion' in node)) return null;

  const mark = (node as Record<string, unknown>).suggestion;
  if (!mark || typeof mark !== 'object' || Array.isArray(mark)) return null;

  const blockSuggestion = mark as SuggestionMark;
  return blockSuggestion.id === suggestionId ? blockSuggestion : null;
}

function resolveBlockSuggestion(
  node: Descendant,
  mark: SuggestionMark,
  action: SuggestionAction
): Descendant | null {
  const cleaned = stripBlockSuggestionMark(node);

  if (mark.type === 'insert' || mark.type === 'replace') {
    return action === 'accept' ? cleaned : null;
  }

  if (mark.type === 'remove') {
    return action === 'accept' ? null : cleaned;
  }

  if (mark.type === 'update') {
    const properties = action === 'accept' ? mark.newProperties : mark.properties;
    return properties ? ({ ...cleaned, ...properties } as Descendant) : cleaned;
  }

  return cleaned;
}

function findSuggestionKey(node: Descendant, suggestionId: string): string | null {
  if (!node || typeof node !== 'object') return null;

  const keys = Object.keys(node).filter(k => k.startsWith('suggestion_'));
  for (const key of keys) {
    const mark = (node as Record<string, unknown>)[key] as SuggestionMark;
    if (mark?.id === suggestionId) {
      return key;
    }
  }
  return null;
}

function stripSuggestionMark(node: Descendant, suggestionKey: string): Descendant {
  const copy = { ...node } as Record<string, unknown>;
  Reflect.deleteProperty(copy, suggestionKey);

  // Remove the suggestion boolean flag if no other suggestion marks remain.
  // This flag is what plate-js uses to render the green/red suggestion highlighting.
  const hasOtherSuggestions = Object.keys(copy).some(k => k.startsWith('suggestion_'));
  if (!hasOtherSuggestions) {
    delete copy.suggestion;
  }

  return copy as Descendant;
}

function stripBlockSuggestionMark(node: Descendant): Descendant {
  const copy = { ...node } as Record<string, unknown>;
  Reflect.deleteProperty(copy, 'suggestion');
  return copy as Descendant;
}

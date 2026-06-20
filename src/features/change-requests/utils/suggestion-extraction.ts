/**
 * Utility functions for extracting suggestion content from document nodes
 */

import type { ReadonlyJSONValue } from '@rocicorp/zero';
import type { Value, Descendant } from 'platejs';

/** Properties diff for a Plate suggestion (subset of TElement properties) */
export type SuggestionProperties = Record<string, string | number | boolean | null | undefined>;
export type PersistedSuggestionProperties = Record<string, string | number | boolean | null>;

export interface ChangeRequestDiffSnapshot {
  change_type: string | null;
  original_text: string | null;
  new_text: string | null;
  original_properties: PersistedSuggestionProperties | null;
  new_properties: PersistedSuggestionProperties | null;
}

export interface SuggestionContent {
  type: string;
  text: string;
  newText: string;
  properties: SuggestionProperties;
  newProperties: SuggestionProperties;
}

const RENDERABLE_SUGGESTION_TYPES = new Set(['insert', 'remove', 'replace', 'update']);

export function isRenderableSuggestionType(type: string | null | undefined): boolean {
  return !!type && RENDERABLE_SUGGESTION_TYPES.has(type);
}

export function hasRenderableSuggestionContent(content: SuggestionContent): boolean {
  return (
    isRenderableSuggestionType(content.type) &&
    (content.text.length > 0 ||
      content.newText.length > 0 ||
      Object.keys(content.properties).length > 0 ||
      Object.keys(content.newProperties).length > 0)
  );
}

/**
 * Extract suggestion text and metadata from document content
 */
export function extractSuggestionContent(
  discussionId: string,
  documentContent: Value | undefined
): SuggestionContent {
  if (!documentContent || !Array.isArray(documentContent)) {
    return { type: 'unknown', text: '', newText: '', properties: {}, newProperties: {} };
  }

  let type = 'unknown';
  let text = '';
  let newText = '';
  let properties: SuggestionProperties = {};
  let newProperties: SuggestionProperties = {};
  const seenTypes = new Set<string>();

  // Recursively search through the document content for suggestion marks
  const searchNodes = (nodes: Descendant[]): void => {
    for (const node of nodes) {
      if (node && typeof node === 'object') {
        // Look for suggestion_* properties
        const suggestionKeys = Object.keys(node).filter(key => key.startsWith('suggestion_'));

        for (const key of suggestionKeys) {
          const suggestionData = node[key] as
            | {
                id?: string;
                type?: string;
                properties?: SuggestionProperties;
                newProperties?: SuggestionProperties;
              }
            | undefined;
          if (suggestionData && suggestionData.id === discussionId) {
            if (suggestionData.type) {
              seenTypes.add(suggestionData.type);
              type = suggestionData.type;
            }

            // Extract text based on type
            if (node.text) {
              if (suggestionData.type === 'insert') {
                newText += node.text;
              } else if (suggestionData.type === 'remove') {
                text += node.text;
              } else if (suggestionData.type === 'replace') {
                newText += node.text;
              } else if (suggestionData.type === 'update') {
                newText += node.text;
                // For update type, store the property changes
                if (suggestionData.properties) {
                  properties = { ...properties, ...suggestionData.properties };
                }
                if (suggestionData.newProperties) {
                  newProperties = { ...newProperties, ...suggestionData.newProperties };
                }
              }
            }
          }
        }

        // Recursively search children
        if (node.children && Array.isArray(node.children)) {
          searchNodes(node.children);
        }
      }
    }
  };

  searchNodes(documentContent);
  if (text && newText && (seenTypes.has('insert') || seenTypes.has('remove'))) {
    type = 'replace';
  } else if (seenTypes.has('replace')) {
    type = 'replace';
  }

  return { type, text, newText, properties, newProperties };
}

function countPropertyCharacters(properties: SuggestionProperties): number {
  return Object.entries(properties).reduce((sum, [key, value]) => {
    if (value == null) {
      return sum + key.length;
    }

    return sum + key.length + String(value).length;
  }, 0);
}

export function countChangedCharacters(content: SuggestionContent): number {
  return (
    content.text.length +
    content.newText.length +
    countPropertyCharacters(content.properties) +
    countPropertyCharacters(content.newProperties)
  );
}

export function countChangedCharactersForSuggestion(
  discussionId: string,
  documentContent: Value | undefined
): number {
  return countChangedCharacters(extractSuggestionContent(discussionId, documentContent));
}

function normalizeProperties(
  properties: SuggestionProperties | ReadonlyJSONValue | null | undefined
): PersistedSuggestionProperties {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties as Record<string, unknown>)
      .filter((entry): entry is [string, string | number | boolean | null] => {
        const value = entry[1];
        return (
          value === null ||
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        );
      })
      .map(([key, value]) => [key, value])
  );
}

function nullableProperties(
  properties: SuggestionProperties
): PersistedSuggestionProperties | null {
  const normalized = normalizeProperties(properties);
  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function createChangeRequestDiffSnapshotFromContent(
  content: SuggestionContent
): ChangeRequestDiffSnapshot {
  return {
    change_type: isRenderableSuggestionType(content.type) ? content.type : null,
    original_text: content.text || null,
    new_text: content.newText || null,
    original_properties: nullableProperties(content.properties),
    new_properties: nullableProperties(content.newProperties),
  };
}

export function createChangeRequestDiffSnapshot(
  discussionId: string,
  documentContent: Value | undefined
) {
  const content = extractSuggestionContent(discussionId, documentContent);

  return {
    ...createChangeRequestDiffSnapshotFromContent(content),
    changed_character_count: countChangedCharacters(content),
  };
}

export function suggestionContentFromChangeRequestSnapshot(snapshot: {
  change_type?: string | null;
  original_text?: string | null;
  new_text?: string | null;
  original_properties?: ReadonlyJSONValue | null;
  new_properties?: ReadonlyJSONValue | null;
}): SuggestionContent {
  return {
    type: snapshot.change_type ?? 'unknown',
    text: snapshot.original_text ?? '',
    newText: snapshot.new_text ?? '',
    properties: normalizeProperties(snapshot.original_properties),
    newProperties: normalizeProperties(snapshot.new_properties),
  };
}

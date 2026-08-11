import { BaseSuggestionPlugin } from '@platejs/suggestion';
import { TextApi, type Point, type TRange, type Value } from 'platejs';
import type { PlateEditor } from 'platejs/react';

export function getEditorContentSignature(value: unknown): string {
  const normalize = (currentValue: unknown): unknown => {
    if (Array.isArray(currentValue)) return currentValue.map(normalize);
    if (currentValue === null || typeof currentValue !== 'object') return currentValue;

    return Object.keys(currentValue)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const childValue = (currentValue as Record<string, unknown>)[key];
        if (childValue !== undefined) result[key] = normalize(childValue);
        return result;
      }, {});
  };

  return JSON.stringify(normalize(value ?? null));
}

export function areEditorValuesEqual(left: unknown, right: unknown): boolean {
  return getEditorContentSignature(left) === getEditorContentSignature(right);
}

export function hasEditorContentOperations(operations: readonly { type: string }[]): boolean {
  return operations.some(operation => operation.type !== 'set_selection');
}

interface LogicalEditorPoint {
  blockId: string | null;
  preferNextAtBoundary: boolean;
  rootIndex: number;
  textOffset: number;
}

interface LogicalEditorSelection {
  anchor: LogicalEditorPoint;
  focus: LogicalEditorPoint;
}

function getLogicalEditorPoint(editor: PlateEditor, point: Point): LogicalEditorPoint {
  const rootIndex = point.path[0] ?? 0;
  const rootNode = editor.children[rootIndex] as { id?: unknown } | undefined;
  let textOffset = point.offset;

  try {
    const blockStart = editor.api.start([rootIndex]);
    if (blockStart) {
      textOffset = editor.api.string({ anchor: blockStart, focus: point }).length;
    }
  } catch {
    // Keep the leaf-local offset as a safe fallback for malformed selections.
  }

  return {
    blockId: typeof rootNode?.id === 'string' ? rootNode.id : null,
    preferNextAtBoundary: point.offset === 0 && textOffset > 0,
    rootIndex,
    textOffset,
  };
}

function getLogicalEditorSelection(
  editor: PlateEditor,
  selection: TRange | null
): LogicalEditorSelection | null {
  if (!selection) return null;

  return {
    anchor: getLogicalEditorPoint(editor, selection.anchor),
    focus: getLogicalEditorPoint(editor, selection.focus),
  };
}

function resolveRootIndex(editor: PlateEditor, point: LogicalEditorPoint): number | null {
  if (editor.children.length === 0) return null;

  if (point.blockId) {
    const matchingIndex = editor.children.findIndex(
      node => (node as { id?: unknown }).id === point.blockId
    );
    if (matchingIndex >= 0) return matchingIndex;
  }

  return Math.min(Math.max(point.rootIndex, 0), editor.children.length - 1);
}

function resolveLogicalEditorPoint(
  editor: PlateEditor,
  logicalPoint: LogicalEditorPoint
): Point | null {
  const rootIndex = resolveRootIndex(editor, logicalPoint);
  if (rootIndex === null) return null;

  let remainingOffset = logicalPoint.textOffset;
  const textNodes = editor.api.nodes({
    at: [rootIndex],
    match: node => TextApi.isText(node),
  });

  for (const [node, path] of textNodes) {
    if (!TextApi.isText(node)) continue;

    const isWithinLeaf = remainingOffset < node.text.length;
    const isAtPreferredBoundary =
      remainingOffset === node.text.length && !logicalPoint.preferNextAtBoundary;

    if (isWithinLeaf || isAtPreferredBoundary) {
      return { path, offset: remainingOffset };
    }

    remainingOffset -= node.text.length;
  }

  return editor.api.end([rootIndex]) ?? editor.api.end([]) ?? null;
}

function getRestoredEditorSelection(
  editor: PlateEditor,
  selection: LogicalEditorSelection | null
): TRange | null {
  if (!selection) return null;

  const anchor = resolveLogicalEditorPoint(editor, selection.anchor);
  const focus = resolveLogicalEditorPoint(editor, selection.focus);
  if (!anchor || !focus) return null;

  return { anchor, focus };
}

export function replaceEditorValuePreservingSelection(
  editor: PlateEditor,
  value: Value,
  preserveSelection: boolean
): TRange | null {
  const previousSelection = getLogicalEditorSelection(editor, editor.selection);
  let restoredSelection: TRange | null = null;

  editor.tf.withoutSaving(() => {
    editor.tf.deselect();
    const suggestionApi = editor.getApi(BaseSuggestionPlugin).suggestion;
    const setExternalValue = () => editor.tf.setValue(value);

    if (suggestionApi) suggestionApi.withoutSuggestions(setExternalValue);
    else setExternalValue();

    if (preserveSelection) {
      restoredSelection = getRestoredEditorSelection(editor, previousSelection);
      if (restoredSelection) editor.tf.select(restoredSelection);
    }
  });

  return restoredSelection;
}

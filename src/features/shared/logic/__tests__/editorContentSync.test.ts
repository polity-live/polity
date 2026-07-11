import { describe, expect, it } from 'vitest';
import { BaseSuggestionPlugin } from '@platejs/suggestion';
import type { Value } from 'platejs';
import { createPlateEditor } from 'platejs/react';

import {
  areEditorValuesEqual,
  hasEditorContentOperations,
  replaceEditorValuePreservingSelection,
} from '../editorContentSync';

const paragraph = (text: string): Value => [
  {
    type: 'p',
    children: [{ text }],
  },
];

describe('editorContentSync', () => {
  it('recognizes structurally equal values as a semantic no-op', () => {
    expect(areEditorValuesEqual(paragraph('Text'), paragraph('Text'))).toBe(true);
    expect(areEditorValuesEqual(paragraph('Text'), paragraph('Other'))).toBe(false);
  });

  it('ignores object key order when comparing persisted editor values', () => {
    const left = [{ type: 'p', children: [{ text: 'Text', bold: true }] }] as Value;
    const right = [{ children: [{ bold: true, text: 'Text' }], type: 'p' }] as Value;

    expect(areEditorValuesEqual(left, right)).toBe(true);
  });

  it('does not classify cursor-only operations as content changes', () => {
    expect(hasEditorContentOperations([{ type: 'set_selection' }])).toBe(false);
    expect(hasEditorContentOperations([{ type: 'insert_node' }, { type: 'set_selection' }])).toBe(
      true
    );
  });

  it('restores a selection at the same path after an external value update', () => {
    const editor = createPlateEditor({ value: paragraph('Original text') });
    editor.selection = {
      anchor: { path: [0, 0], offset: 8 },
      focus: { path: [0, 0], offset: 8 },
    };

    const restored = replaceEditorValuePreservingSelection(
      editor,
      paragraph('External text'),
      true
    );

    expect(restored).toEqual({
      anchor: { path: [0, 0], offset: 8 },
      focus: { path: [0, 0], offset: 8 },
    });
    expect(editor.selection).toEqual(restored);
  });

  it('clamps selection offsets when external text becomes shorter', () => {
    const editor = createPlateEditor({ value: paragraph('Original text') });
    editor.selection = {
      anchor: { path: [0, 0], offset: 12 },
      focus: { path: [0, 0], offset: 12 },
    };

    replaceEditorValuePreservingSelection(editor, paragraph('Short'), true);

    expect(editor.selection).toEqual({
      anchor: { path: [0, 0], offset: 5 },
      focus: { path: [0, 0], offset: 5 },
    });
  });

  it('keeps the absolute line offset when suggestion leaves are merged externally', () => {
    const editor = createPlateEditor({
      value: [
        {
          id: 'block-1',
          type: 'p',
          children: [
            { text: 'Hello ' },
            {
              text: 'world',
              suggestion: true,
              suggestion_test: { id: 'test', type: 'insert', userId: 'user-1' },
            },
          ],
        },
      ],
    });
    editor.selection = {
      anchor: { path: [0, 1], offset: 3 },
      focus: { path: [0, 1], offset: 3 },
    };

    replaceEditorValuePreservingSelection(
      editor,
      [{ id: 'block-1', type: 'p', children: [{ text: 'Hello world!' }] }],
      true
    );

    expect(editor.selection).toEqual({
      anchor: { path: [0, 0], offset: 9 },
      focus: { path: [0, 0], offset: 9 },
    });
  });

  it('follows a stable block id when external content reorders blocks', () => {
    const editor = createPlateEditor({
      value: [
        { id: 'block-1', type: 'p', children: [{ text: 'First' }] },
        { id: 'block-2', type: 'p', children: [{ text: 'Second line' }] },
      ],
    });
    editor.selection = {
      anchor: { path: [1, 0], offset: 6 },
      focus: { path: [1, 0], offset: 6 },
    };

    replaceEditorValuePreservingSelection(
      editor,
      [
        { id: 'block-2', type: 'p', children: [{ text: 'Second line updated' }] },
        { id: 'block-1', type: 'p', children: [{ text: 'First' }] },
      ],
      true
    );

    expect(editor.selection).toEqual({
      anchor: { path: [0, 0], offset: 6 },
      focus: { path: [0, 0], offset: 6 },
    });
  });

  it('falls back to the nearest remaining root block when a selected block was removed', () => {
    const editor = createPlateEditor({
      value: [
        { type: 'p', children: [{ text: 'First' }] },
        { type: 'p', children: [{ text: 'Removed block' }] },
      ],
    });
    editor.selection = {
      anchor: { path: [1, 0], offset: 7 },
      focus: { path: [1, 0], offset: 7 },
    };

    replaceEditorValuePreservingSelection(editor, paragraph('Remaining'), true);

    expect(editor.selection).toEqual({
      anchor: { path: [0, 0], offset: 7 },
      focus: { path: [0, 0], offset: 7 },
    });
  });

  it('does not add external value replacement operations to undo history', () => {
    const editor = createPlateEditor({ value: paragraph('Original') });
    editor.selection = {
      anchor: { path: [0, 0], offset: 8 },
      focus: { path: [0, 0], offset: 8 },
    };

    replaceEditorValuePreservingSelection(editor, paragraph('External'), true);

    expect(editor.history.undos).toHaveLength(0);
  });

  it('does not turn an external value replacement into a whole-document suggestion', () => {
    const editor = createPlateEditor({
      plugins: [BaseSuggestionPlugin],
      value: paragraph('Original'),
    });
    editor.setOption(BaseSuggestionPlugin, 'currentUserId', 'user-1');
    editor.setOption(BaseSuggestionPlugin, 'isSuggesting', true);
    editor.selection = {
      anchor: { path: [0, 0], offset: 8 },
      focus: { path: [0, 0], offset: 8 },
    };

    replaceEditorValuePreservingSelection(editor, paragraph('External'), true);

    expect(editor.children).toEqual(paragraph('External'));
    expect(JSON.stringify(editor.children)).not.toContain('suggestion');
    expect(editor.getOption(BaseSuggestionPlugin, 'isSuggesting')).toBe(true);
    expect(editor.selection).toEqual({
      anchor: { path: [0, 0], offset: 8 },
      focus: { path: [0, 0], offset: 8 },
    });
  });

  it('keeps the selection after Plate creates the first inline suggestion leaf', () => {
    const editor = createPlateEditor({
      plugins: [BaseSuggestionPlugin],
      value: paragraph('Original'),
    });
    editor.setOption(BaseSuggestionPlugin, 'currentUserId', 'user-1');
    editor.setOption(BaseSuggestionPlugin, 'isSuggesting', true);
    editor.selection = {
      anchor: { path: [0, 0], offset: 8 },
      focus: { path: [0, 0], offset: 8 },
    };

    editor.tf.insertText('X');

    expect(editor.api.string([])).toBe('OriginalX');
    expect(editor.selection).toEqual({
      anchor: { path: [0, 1], offset: 1 },
      focus: { path: [0, 1], offset: 1 },
    });
  });
});

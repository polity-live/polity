import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { Plate, PlateContent, createPlateEditor } from 'platejs/react';
import { EditorKitWithoutFixedToolbar } from '@/features/shared/ui/kit-platejs/editor-kit';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import { bindPlateDocument } from '../logic/plate';
import { seedDocument, projectDocument } from '../logic/codec';
import * as Y from 'yjs';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ session: null }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
describe('collaborative typing in Chromium', () => {
  it('keeps native navigation at the destination before the next character arrives', async () => {
    const doc = seedDocument('document', [
      { id: 'start', type: 'p', children: [{ text: 'Start' }] },
      { id: 'end', type: 'p', children: [{ text: 'Destination' }] },
    ]);
    const editor = bindPlateDocument(
      createPlateEditor({ plugins: EditorKitWithoutFixedToolbar }),
      doc
    );
    editor.connect();
    const view = render(
      <Plate editor={editor}>
        <PlateContent aria-label="Native navigation document" />
      </Plate>
    );
    try {
      editor.tf.select({ path: [0, 0], offset: 2 });
      editor.tf.focus();
      await vi.waitFor(() => expect(editor.api.isFocused()).toBe(true));
      const target = view.getByRole('textbox', { name: 'Native navigation document' });
      // Reproduce the interval before Slate's throttled selectionchange handler:
      // the browser has moved to the end, but Slate still remembers the old caret.
      const destination = editor.api.toDOMPoint({ path: [1, 0], offset: 11 });
      const domSelection = window.getSelection();
      if (!destination || !domSelection) throw new Error('Native caret unavailable');
      const [node, offset] = destination;
      domSelection.collapse(node, offset);
      target.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'End', ctrlKey: true, bubbles: true })
      );
      expect(editor.selection).toEqual({
        anchor: { path: [1, 0], offset: 11 },
        focus: { path: [1, 0], offset: 11 },
      });
      await userEvent.keyboard('Fast input');
      await vi.waitFor(() => expect(editor.api.string([1])).toBe('DestinationFast input'));
      expect(editor.api.string([0])).toBe('Start');
    } finally {
      cleanup();
      editor.disconnect();
      doc.destroy();
    }
  });
  it('synchronizes text, table cells and media while undo preserves the other editor changes', async () => {
    const first = seedDocument('document', [
      { id: 'p', type: 'p', children: [{ text: 'Original' }] },
      {
        id: 'table',
        type: 'table',
        children: [
          {
            id: 'row',
            type: 'tr',
            children: [
              {
                id: 'cell',
                type: 'td',
                children: [{ id: 'cell-p', type: 'p', children: [{ text: 'Cell' }] }],
              },
            ],
          },
        ],
      },
      {
        id: 'image',
        type: 'img',
        url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        alt: 'Original image',
        children: [{ text: '' }],
      },
    ]);
    const alice = bindPlateDocument(
      createPlateEditor({ plugins: EditorKitWithoutFixedToolbar }),
      first
    );
    alice.connect();
    alice.flushLocalChanges();
    const second = new Y.Doc();
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
    const bob = bindPlateDocument(
      createPlateEditor({ plugins: EditorKitWithoutFixedToolbar }),
      second
    );
    bob.connect();
    bob.flushLocalChanges();
    first.on('update', update => Y.applyUpdate(second, update, 'peer'));
    second.on('update', update => Y.applyUpdate(first, update, 'peer'));
    render(
      <>
        <Plate editor={alice}>
          <PlateContent aria-label="Alice document" />
        </Plate>
        <Plate editor={bob}>
          <PlateContent aria-label="Bob document" />
        </Plate>
      </>
    );
    try {
      alice.tf.select({ path: [0, 0], offset: 8 });
      alice.tf.focus();
      await vi.waitFor(() => {
        const selection = window.getSelection();
        expect(
          selection && alice.api.toSlateRange(selection, { exactMatch: false, suppressThrow: true })
        ).toEqual(alice.selection);
      });
      await userEvent.keyboard(' Alice');
      await vi.waitFor(() => expect(bob.api.string([0])).toBe('Original Alice'));
      bob.tf.select({ path: [1, 0, 0, 0, 0], offset: 4 });
      bob.tf.focus();
      await vi.waitFor(() => {
        const selection = window.getSelection();
        expect(
          selection && bob.api.toSlateRange(selection, { exactMatch: false, suppressThrow: true })
        ).toEqual(bob.selection);
      });
      await userEvent.keyboard(' Bob');
      bob.tf.setNodes({ alt: 'Bob image' }, { at: [2] });
      await vi.waitFor(() => expect(alice.api.string([1])).toBe('Cell Bob'));
      alice.tf.undo();
      expect(alice.api.string([0])).toBe('Original');
      expect(alice.api.string([1])).toBe('Cell Bob');
      expect(alice.children[2].alt).toBe('Bob image');
      expect(projectDocument('document', first)).toEqual(projectDocument('document', second));
    } finally {
      cleanup();
      alice.disconnect();
      bob.disconnect();
      first.destroy();
      second.destroy();
    }
  });
  it('preserves character order and local undo while entering an insertion proposal', async () => {
    const doc = seedDocument('document', [{ id: 'p', type: 'p', children: [{ text: '' }] }]);
    const editor = bindPlateDocument(
      createPlateEditor({ plugins: EditorKitWithoutFixedToolbar }),
      doc
    );
    editor.setOption(SuggestionPlugin, 'isSuggesting', true);
    editor.setOption(SuggestionPlugin, 'currentUserId', 'author');
    editor.connect();

    render(
      <Plate editor={editor}>
        <PlateContent aria-label="Collaborative document" />
      </Plate>
    );
    try {
      await userEvent.click(page.getByRole('textbox', { name: 'Collaborative document' }));
      await userEvent.keyboard('Mehr Schatten');
      await vi.waitFor(() => expect(editor.api.string([])).toBe('Mehr Schatten'));

      expect(JSON.stringify(projectDocument('document', doc))).toContain('Mehr Schatten');
      editor.tf.undo();
      expect(editor.api.string([])).toBe('');
    } finally {
      cleanup();
      editor.disconnect();
      doc.destroy();
    }
  });
});

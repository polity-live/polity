/* @vitest-environment jsdom */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Plate, createPlateEditor } from 'platejs/react';
import { CursorOverlayPlugin } from '@platejs/selection/react';
import { slateRangeToRelativeRange } from '@slate-yjs/core';
import * as Y from 'yjs';
import { seedDocument } from '../logic/codec';
import { bindPlateDocument } from '../logic/plate';
import { CollaborationCursors } from '../ui/CollaborationCursors';
import type { CollaborationClient } from '../hooks/useCollaborationDocument';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('keeps peer cursors attached across inserted text, sanitizes color and removes stale or invalid peer selections', () => {
  vi.useFakeTimers();
  const doc = seedDocument('document', [{ id: 'p', type: 'p', children: [{ text: 'Hello' }] }]);
  const editor = bindPlateDocument(createPlateEditor({ plugins: [CursorOverlayPlugin] }), doc);
  editor.connect();
  const overlay = editor.getApi(CursorOverlayPlugin).cursorOverlay;
  const added = vi.spyOn(overlay, 'addCursor'),
    removed = vi.spyOn(overlay, 'removeCursor');
  const range = slateRangeToRelativeRange(doc.get('content', Y.XmlText), editor, {
    anchor: { path: [0, 0], offset: 2 },
    focus: { path: [0, 0], offset: 4 },
  });
  const encode = (position: Y.RelativePosition) =>
    btoa(String.fromCharCode(...Y.encodeRelativePosition(position)));
  const states = new Map<number, any>([
    [doc.clientID, { cursor: { anchor: encode(range.anchor), focus: encode(range.focus) } }],
    [
      123,
      {
        user: { color: 'url(untrusted)' },
        cursor: { anchor: encode(range.anchor), focus: encode(range.focus) },
      },
    ],
  ]);
  const awareness = {
    getStates: () => states,
    setLocalStateField: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  const client = { doc, provider: { awareness } } as unknown as CollaborationClient;
  const view = render(
    <Plate editor={editor}>
      <CollaborationCursors client={client} />
    </Plate>
  );
  act(() => {
    editor.tf.select({ path: [0, 0], offset: 0 });
    editor.tf.insertText('XX');
    vi.advanceTimersByTime(150);
  });
  expect(added).toHaveBeenCalledWith(
    '123',
    expect.objectContaining({
      selection: { anchor: { path: [0, 0], offset: 4 }, focus: { path: [0, 0], offset: 6 } },
      data: expect.objectContaining({ style: { backgroundColor: '#B88A3B' } }),
    })
  );
  expect(added.mock.calls.some(call => call[0] === String(doc.clientID))).toBe(false);
  expect(awareness.setLocalStateField).toHaveBeenCalledWith(
    'cursor',
    expect.objectContaining({ anchor: expect.any(String), focus: expect.any(String) })
  );
  states.set(124, {
    user: { color: '#12362D' },
    cursor: { anchor: encode(range.anchor), focus: encode(range.focus) },
  });
  act(() => {
    editor.tf.deselect();
    vi.advanceTimersByTime(150);
  });
  expect(added).toHaveBeenCalledWith(
    '124',
    expect.objectContaining({
      data: expect.objectContaining({ style: { backgroundColor: '#12362D' } }),
    })
  );
  expect(awareness.setLocalStateField).toHaveBeenLastCalledWith('cursor', null);
  states.set(123, { cursor: { anchor: '%%%invalid', focus: '%%%invalid' } });
  const absent = new Y.Doc();
  const absentText = absent.getText('unavailable');
  absentText.insert(0, 'Not part of the shared editor');
  const absentPosition = encode(Y.createRelativePositionFromTypeIndex(absentText, 1));
  states.set(125, { cursor: { anchor: absentPosition, focus: absentPosition } });
  act(() => vi.advanceTimersByTime(150));
  expect(removed).toHaveBeenCalledWith('123');
  expect(added.mock.calls.some(call => call[0] === '125')).toBe(false);
  absent.destroy();
  view.unmount();
  expect(removed).toHaveBeenCalledWith('124');
  expect(awareness.off).toHaveBeenCalledWith('change', expect.any(Function));
  expect(awareness.setLocalStateField).toHaveBeenLastCalledWith('cursor', null);
  editor.disconnect();
  doc.destroy();
});
it('has no secondary presence channel when a document or awareness provider is absent', () => {
  const editor = createPlateEditor({ plugins: [CursorOverlayPlugin] });
  const view = render(
    <Plate editor={editor}>
      <CollaborationCursors />
    </Plate>
  );
  const doc = seedDocument('document', []);
  vi.useFakeTimers();
  const awareness = {
    getStates: () => new Map(),
    setLocalStateField: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  view.rerender(
    <Plate editor={editor}>
      <CollaborationCursors
        client={{ doc, provider: { awareness } } as unknown as CollaborationClient}
      />
    </Plate>
  );
  act(() => vi.advanceTimersByTime(150));
  expect(awareness.setLocalStateField).toHaveBeenCalledWith('cursor', null);
  view.rerender(
    <Plate editor={editor}>
      <CollaborationCursors client={{ doc, provider: null } as unknown as CollaborationClient} />
    </Plate>
  );
  expect(editor.getApi(CursorOverlayPlugin).cursorOverlay).toBeDefined();
  view.unmount();
  doc.destroy();
});

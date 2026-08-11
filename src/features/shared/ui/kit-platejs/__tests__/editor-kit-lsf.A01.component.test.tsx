/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ editor: { id: 'editor' } }));

vi.mock('platejs/react', async importOriginal => ({
  ...(await importOriginal<typeof import('platejs/react')>()),
  useEditorRef: () => mocks.editor,
}));

import { EditorKitWithoutFixedToolbar, useEditor } from '../editor-kit';

describe('editor kit remaining facade', () => {
  it('filters the fixed toolbar and returns the typed editor ref', () => {
    expect(EditorKitWithoutFixedToolbar.every(plugin => plugin.key !== 'fixed-toolbar')).toBe(true);
    expect(renderHook(() => useEditor()).result.current).toBe(mocks.editor);
  });
});

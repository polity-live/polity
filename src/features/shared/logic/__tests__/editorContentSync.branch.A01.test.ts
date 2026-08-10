import { describe, expect, it, vi } from 'vitest';

import { replaceEditorValuePreservingSelection } from '../editorContentSync';

describe('replaceEditorValuePreservingSelection mixed node entries', () => {
  it('skips non-text nodes while resolving the logical text point', () => {
    const select = vi.fn();
    const editor = {
      children: [{ id: 'block', type: 'p', children: [{ text: 'abc' }] }],
      selection: {
        anchor: { path: [0, 0], offset: 1 },
        focus: { path: [0, 0], offset: 1 },
      },
      api: {
        start: () => ({ path: [0, 0], offset: 0 }),
        string: () => 'a',
        nodes: () => [
          [{ type: 'inline' }, [0, 0]],
          [{ text: 'abc' }, [0, 1]],
        ],
        end: () => ({ path: [0, 1], offset: 3 }),
      },
      tf: {
        withoutSaving: (callback: () => void) => callback(),
        deselect: vi.fn(),
        setValue: vi.fn(),
        select,
      },
      getApi: () => ({ suggestion: undefined }),
    };

    expect(
      replaceEditorValuePreservingSelection(
        editor as never,
        [{ type: 'p', children: [{ text: 'changed' }] }],
        true
      )
    ).toEqual({
      anchor: { path: [0, 1], offset: 1 },
      focus: { path: [0, 1], offset: 1 },
    });
    expect(select).toHaveBeenCalled();
  });
});

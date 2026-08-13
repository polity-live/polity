/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ setOption: vi.fn(), setReadOnly: vi.fn() }));

vi.mock('platejs/react', () => ({
  useEditorPlugin: () => ({ setOption: mocks.setOption }),
  usePlateState: () => [false, mocks.setReadOnly],
}));
vi.mock('@platejs/suggestion/react', () => ({ SuggestionPlugin: {} }));

import { useModeSyncController } from '../useModeSyncController';

describe('useModeSyncController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing without a current mode', () => {
    renderHook(() => useModeSyncController({ currentMode: undefined, readOnly: false }));
    expect(mocks.setReadOnly).not.toHaveBeenCalled();
  });

  it.each([
    ['edit', true, true, false],
    ['view', false, true, false],
    ['vote_internal', false, true, false],
    ['event_final_closing_vote', false, true, false],
    ['edit', false, false, false],
    ['suggest_internal', false, false, true],
    ['suggest_event', false, false, true],
  ] as const)(
    'syncs %s with readOnly=%s',
    (currentMode, readOnly, expectedReadOnly, suggesting) => {
      renderHook(() => useModeSyncController({ currentMode, readOnly }));
      expect(mocks.setReadOnly).toHaveBeenCalledWith(expectedReadOnly);
      expect(mocks.setOption).toHaveBeenCalledWith('isSuggesting', suggesting);
    }
  );
});

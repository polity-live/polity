// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readOnly: false,
  isSuggesting: false,
  setReadOnly: vi.fn((value: boolean) => {
    mocks.readOnly = value;
  }),
  setOption: vi.fn(),
  focus: vi.fn(),
}));

vi.mock('@platejs/suggestion/react', () => ({ SuggestionPlugin: { key: 'suggestion' } }));

vi.mock('platejs/react', () => ({
  useEditorRef: () => ({ setOption: mocks.setOption, tf: { focus: mocks.focus } }),
  usePlateState: () => [mocks.readOnly, mocks.setReadOnly],
  usePluginOption: () => mocks.isSuggesting,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  getEditingModeOption: (mode: string, t: (key: string) => string) => ({
    mode,
    label: t(`mode.${mode}`),
  }),
}));

import type { EditorMode } from '@/features/editor/types';
import { useModeToolbarButtonController } from '../useModeToolbarButtonController';

beforeEach(() => {
  mocks.readOnly = false;
  mocks.isSuggesting = false;
  mocks.setReadOnly.mockClear();
  mocks.setOption.mockClear();
  mocks.focus.mockClear();
});

describe('useModeToolbarButtonController', () => {
  it('derives edit, view, suggestion, and externally controlled modes', async () => {
    const { result, rerender } = renderHook(
      ({ currentMode }: { currentMode?: EditorMode }) =>
        useModeToolbarButtonController({ currentMode }),
      { initialProps: { currentMode: undefined } as { currentMode?: EditorMode } }
    );
    expect(result.current.mode).toBe('edit');
    expect(result.current.currentOption).toMatchObject({ mode: 'edit', label: 'mode.edit' });
    expect(result.current.labels).toEqual({
      editingMode: 'plateJs.toolbar.editingMode',
      viewOnly: 'plateJs.toolbar.mode.viewOnly',
    });

    mocks.readOnly = true;
    rerender({ currentMode: undefined });
    await waitFor(() => expect(result.current.mode).toBe('view'));

    mocks.readOnly = false;
    mocks.isSuggesting = true;
    rerender({ currentMode: undefined });
    await waitFor(() => expect(result.current.mode).toBe('suggest_internal'));

    mocks.readOnly = true;
    rerender({ currentMode: 'edit' });
    await waitFor(() => expect(result.current.mode).toBe('edit'));

    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
  });

  it('keeps an external change optimistic until the controlled mode catches up', async () => {
    const onModeChange = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      ({ currentMode }: { currentMode: EditorMode }) =>
        useModeToolbarButtonController({ currentMode, onModeChange }),
      { initialProps: { currentMode: 'edit' as EditorMode } }
    );

    await act(async () => result.current.onModeChange('view'));
    expect(onModeChange).toHaveBeenCalledWith('view');
    expect(result.current.mode).toBe('view');

    rerender({ currentMode: 'edit' });
    expect(result.current.mode).toBe('view');
    rerender({ currentMode: 'view' });
    await waitFor(() => expect(result.current.mode).toBe('view'));

    await act(async () => result.current.onModeChange('view'));
    expect(onModeChange).toHaveBeenCalledTimes(1);
  });

  it('rolls an external change back when its callback rejects', async () => {
    const onModeChange = vi.fn(async () => {
      throw new Error('rejected');
    });
    const { result } = renderHook(() =>
      useModeToolbarButtonController({ currentMode: 'edit', onModeChange })
    );

    await act(async () => result.current.onModeChange('suggest_event'));
    expect(result.current.mode).toBe('edit');
  });

  it('updates editor read-only and suggestion state for every local mode', async () => {
    const { result } = renderHook(() => useModeToolbarButtonController({}));

    for (const mode of [
      'view',
      'vote_internal',
      'event_final_closing_vote',
      'suggest_internal',
      'suggest_event',
      'edit',
    ] as const) {
      await act(async () => result.current.onModeChange(mode));
    }

    expect(mocks.setReadOnly.mock.calls.map(call => call[0])).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(mocks.setOption.mock.calls.map(call => call[2])).toEqual([
      false,
      false,
      false,
      true,
      true,
      false,
    ]);
    expect(mocks.focus).toHaveBeenCalledTimes(1);
  });
});

/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      key.endsWith('nSelected') ? `${values?.count ?? 0} selected` : key,
  }),
}));

import { useSuggestionViewToggleController } from '../useSuggestionViewToggleController';

afterEach(cleanup);

const discussion = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'discussion-1',
    crId: 'CR-1',
    title: '',
    userId: 'user-1',
    comments: [],
    createdAt: new Date(0),
    isResolved: false,
    ...overrides,
  }) as never;

describe('useSuggestionViewToggleController branch campaign A03', () => {
  it('builds aliases and labels for unfiltered, known, unknown, and multi selections', () => {
    const onChange = vi.fn();
    let selected: Set<string> | null = null;
    const discussions = [
      discussion({
        id: 'discussion-1',
        crId: 'CR-1',
        displayCrId: null,
        title: '',
        changeRequestEntityId: null,
      }),
      discussion({ id: 'discussion-2', crId: '', title: 'filtered' }),
    ];
    const { result, rerender } = renderHook(() =>
      useSuggestionViewToggleController({
        discussions,
        selectedCrIds: selected,
        onSelectedCrIdsChange: onChange,
      })
    );
    expect(result.current.crOptions).toHaveLength(1);
    expect(result.current.crOptions[0]).toMatchObject({ displayCrId: 'CR-1', title: 'CR-1' });
    expect(result.current.buttonLabel).toContain('allSuggestions');
    expect(result.current.allSelected).toBe(false);

    selected = new Set(['CR-1']);
    rerender();
    expect(result.current.buttonLabel).toBe('CR-1');
    expect(result.current.allSelected).toBe(true);

    selected = new Set(['unknown']);
    rerender();
    expect(result.current.buttonLabel).toBe('unknown');
    expect(result.current.allSelected).toBe(false);

    selected = new Set(['CR-1', 'unknown']);
    rerender();
    expect(result.current.buttonLabel).toBe('2 selected');
  });

  it('covers open state, mode guards, selection, select-all, and deselect-all', () => {
    const onChange = vi.fn();
    let selected: Set<string> | null = null;
    const { result, rerender } = renderHook(() =>
      useSuggestionViewToggleController({
        discussions: [discussion()],
        selectedCrIds: selected,
        onSelectedCrIdsChange: onChange,
      })
    );
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
    act(() => result.current.onModeChange(''));
    act(() => result.current.onModeChange('select'));
    expect(result.current.filterMode).toBe('select');
    act(() => result.current.onModeChange('choice'));
    expect(result.current.filterMode).toBe('choice');
    act(() => result.current.onModeChange('select'));
    expect(onChange).toHaveBeenCalledWith(null);

    selected = new Set(['CR-1', 'CR-2']);
    rerender();
    act(() => result.current.onModeChange('choice'));
    act(() => result.current.onModeChange('select'));
    expect(onChange).toHaveBeenCalledWith(null);

    selected = new Set(['CR-1']);
    rerender();
    act(() => result.current.onModeChange('choice'));
    act(() => result.current.onModeChange('select'));
    act(() => result.current.onSelectCr('CR-1'));
    expect(onChange).toHaveBeenCalledWith(new Set(['CR-1']));
    act(() => result.current.onSelectCr(null));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(result.current.open).toBe(false);
    act(() => result.current.onSelectAll());
    expect(onChange).toHaveBeenCalledWith(new Set(['CR-1']));
    act(() => result.current.onDeselectAll());
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('removes option aliases, deletes direct unknown ids, and adds absent ids', () => {
    const onChange = vi.fn();
    let selected: Set<string> | null = new Set(['discussion-1', 'other']);
    const { result, rerender } = renderHook(() =>
      useSuggestionViewToggleController({
        discussions: [
          discussion({
            displayCrId: 'Branch 1 CR-1',
            title: 'Proposal',
            changeRequestEntityId: 'change-request-1',
          }),
        ],
        selectedCrIds: selected,
        onSelectedCrIdsChange: onChange,
      })
    );
    act(() => result.current.onToggleCr('CR-1'));
    expect(onChange).toHaveBeenLastCalledWith(new Set(['other']));

    selected = new Set(['unknown']);
    rerender();
    act(() => result.current.onToggleCr('unknown'));
    expect(onChange).toHaveBeenLastCalledWith(null);

    selected = null;
    rerender();
    act(() => result.current.onToggleCr('new-id'));
    expect(onChange).toHaveBeenLastCalledWith(new Set(['new-id']));
  });

  it('keeps allSelected false for an empty option collection', () => {
    const { result } = renderHook(() =>
      useSuggestionViewToggleController({
        discussions: [],
        selectedCrIds: new Set(),
        onSelectedCrIdsChange: vi.fn(),
      })
    );
    expect(result.current.allSelected).toBe(false);
  });
});

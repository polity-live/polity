/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TDiscussion } from '../../types';
import { useSuggestionViewToggleController } from '../useSuggestionViewToggleController';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      key === 'features.editor.suggestionView.nSelected' ? `${values?.count ?? 0} selected` : key,
  }),
}));

function discussion(overrides: Partial<TDiscussion>): TDiscussion {
  return {
    id: 'discussion-1',
    comments: [],
    createdAt: new Date(0),
    isResolved: false,
    userId: 'user-1',
    crId: 'CR-1',
    title: 'CR-1',
    ...overrides,
  };
}

describe('useSuggestionViewToggleController', () => {
  it('uses the display CR label when the selected value is a technical discussion id', () => {
    const technicalId = 'K2dz1V0dhElc3YtOcbLwm';
    const onSelectedCrIdsChange = vi.fn();

    const { result } = renderHook(() =>
      useSuggestionViewToggleController({
        discussions: [
          discussion({
            id: technicalId,
            crId: 'CR-2',
            displayCrId: 'Branch 1 CR-2',
            title: 'CR-2',
            changeRequestEntityId: 'change-request-2',
          }),
        ],
        selectedCrIds: new Set([technicalId]),
        onSelectedCrIdsChange,
      })
    );

    expect(result.current.buttonLabel).toBe('Branch 1 CR-2');
    expect(result.current.allSelected).toBe(true);
  });

  it('deselects an option that was selected through an alias', () => {
    const technicalId = 'change-request-2';
    const onSelectedCrIdsChange = vi.fn();

    const { result } = renderHook(() =>
      useSuggestionViewToggleController({
        discussions: [
          discussion({
            id: 'discussion-2',
            crId: 'CR-2',
            displayCrId: 'Branch 1 CR-2',
            changeRequestEntityId: technicalId,
          }),
        ],
        selectedCrIds: new Set([technicalId]),
        onSelectedCrIdsChange,
      })
    );

    act(() => {
      result.current.onToggleCr('CR-2');
    });

    expect(onSelectedCrIdsChange).toHaveBeenCalledWith(null);
  });
});

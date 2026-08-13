/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AmendmentSearchAndFilters,
  amendmentSearchAndFiltersInternals,
} from '../AmendmentSearchAndFilters';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('AmendmentSearchAndFilters actions', () => {
  it('ignores an empty status toggle value', () => {
    const onStatusChange = vi.fn();
    amendmentSearchAndFiltersInternals.applyStatusFilter('', onStatusChange);
    amendmentSearchAndFiltersInternals.applyStatusFilter('pending', onStatusChange);
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith('pending');
  });
  it('dispatches search, filter toggles, and status choices through stable actions', () => {
    const onSearchChange = vi.fn();
    const onStatusChange = vi.fn();
    const onHashtagChange = vi.fn();
    const onToggleFilters = vi.fn();
    const { container, rerender } = render(
      <AmendmentSearchAndFilters
        filters={{ searchQuery: '', statusFilter: 'all', hashtagFilter: '' }}
        showFilters
        hasActiveFilters={false}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        onHashtagChange={onHashtagChange}
        onToggleFilters={onToggleFilters}
        onClearStatusFilter={vi.fn()}
        onClearHashtagFilter={vi.fn()}
      />
    );

    fireEvent.change(
      container.querySelector('input[placeholder="features.groups.amendments.searchPlaceholder"]')!,
      {
        target: { value: 'budget' },
      }
    );
    fireEvent.change(container.querySelector('#hashtag-filter')!, { target: { value: 'finance' } });
    fireEvent.click(
      container.querySelector('[data-action-id="groups.amendments.toggle.filters"]')!
    );
    for (const [actionId, value] of [
      ['groups.amendments.filter.accepted', 'accepted'],
      ['groups.amendments.filter.pending', 'pending'],
      ['groups.amendments.filter.rejected', 'rejected'],
      ['groups.amendments.filter.withdrawn', 'withdrawn'],
    ]) {
      const action = container.querySelector<HTMLElement>(`[data-action-id="${actionId}"]`)!;
      action.focus();
      expect(document.activeElement).toBe(action);
      fireEvent.click(action);
      expect(onStatusChange).toHaveBeenCalledWith(value);
    }
    rerender(
      <AmendmentSearchAndFilters
        filters={{ searchQuery: '', statusFilter: 'accepted', hashtagFilter: '' }}
        showFilters
        hasActiveFilters={false}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        onHashtagChange={onHashtagChange}
        onToggleFilters={onToggleFilters}
        onClearStatusFilter={vi.fn()}
        onClearHashtagFilter={vi.fn()}
      />
    );
    fireEvent.click(container.querySelector('[data-action-id="groups.amendments.filter.all"]')!);
    expect(onStatusChange).toHaveBeenCalledWith('all');

    expect(onSearchChange).toHaveBeenCalledWith('budget');
    expect(onHashtagChange).toHaveBeenCalledWith('finance');
    expect(onToggleFilters).toHaveBeenCalledTimes(1);
  });

  it('clears collapsed status and hashtag filters through canonical aliases', () => {
    const onClearStatusFilter = vi.fn();
    const onClearHashtagFilter = vi.fn();
    const { container } = render(
      <AmendmentSearchAndFilters
        filters={{ searchQuery: '', statusFilter: 'pending', hashtagFilter: 'finance' }}
        showFilters={false}
        hasActiveFilters
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onHashtagChange={vi.fn()}
        onToggleFilters={vi.fn()}
        onClearStatusFilter={onClearStatusFilter}
        onClearHashtagFilter={onClearHashtagFilter}
      />
    );

    const statusActions = container.querySelectorAll(
      '[data-action-id="groups.amendments.clear.status-filter"]'
    );
    const hashtagActions = container.querySelectorAll(
      '[data-action-id="groups.amendments.clear.hashtag-filter"]'
    );
    expect(statusActions).toHaveLength(2);
    expect(hashtagActions).toHaveLength(2);
    fireEvent.click(statusActions[1]!);
    fireEvent.click(hashtagActions[1]!);
    expect(onClearStatusFilter).toHaveBeenCalledTimes(1);
    expect(onClearHashtagFilter).toHaveBeenCalledTimes(1);
  });

  it('covers custom statuses, outer clear actions, actions, and the expanded hashtag hint', () => {
    const onClearStatusFilter = vi.fn();
    const onClearHashtagFilter = vi.fn();
    const common = {
      onSearchChange: vi.fn(),
      onStatusChange: vi.fn(),
      onHashtagChange: vi.fn(),
      onToggleFilters: vi.fn(),
      onClearStatusFilter,
      onClearHashtagFilter,
    };
    const { container, rerender } = render(
      <AmendmentSearchAndFilters
        {...common}
        filters={{ searchQuery: '', statusFilter: 'custom', hashtagFilter: 'topic' }}
        showFilters={false}
        hasActiveFilters
        actions={<button>Action</button>}
      />
    );
    fireEvent.click(
      container.querySelector('[data-action-id="groups.amendments.clear.status-filter"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="groups.amendments.clear.hashtag-filter"]')!
    );
    expect(onClearStatusFilter).toHaveBeenCalled();
    expect(onClearHashtagFilter).toHaveBeenCalled();
    rerender(
      <AmendmentSearchAndFilters
        {...common}
        filters={{ searchQuery: '', statusFilter: 'all', hashtagFilter: 'topic' }}
        showFilters
        hasActiveFilters
      />
    );
    expect(container.textContent).toContain('#topic');
  });
});

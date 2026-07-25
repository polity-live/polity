/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/groups/ui/AmendmentSearchAndFilters', () => ({
  AmendmentSearchAndFilters: () => <div data-testid="amendment-search-and-filters" />,
}));

vi.mock('@/features/groups/ui/AmendmentGroups', () => ({
  AmendmentGroups: () => <div data-testid="amendment-groups" />,
}));

import { GroupAmendmentsPageView } from '../GroupAmendmentsPageView';

afterEach(() => {
  cleanup();
});

describe('GroupAmendmentsPageView spacing', () => {
  it('keeps the hidden heading outside the visible content stack', () => {
    const { container } = render(
      <GroupAmendmentsPageView
        groupId="group-1"
        groupName="Group One"
        t={(key: string) => key}
        canCreate={() => false}
        groupedAmendments={[]}
        filters={{}}
        showFilters={false}
        hasActiveFilters={false}
        updateFilter={vi.fn()}
        clearFilter={vi.fn()}
        setShowFilters={vi.fn()}
      />
    );

    const heading = container.querySelector('h1.sr-only');
    const visibleContent = heading?.nextElementSibling;

    expect(visibleContent?.className).toContain('space-y-6');
    expect(visibleContent?.contains(heading ?? null)).toBe(false);
  });
});

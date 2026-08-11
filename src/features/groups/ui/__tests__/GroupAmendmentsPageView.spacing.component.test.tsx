/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/groups/ui/AmendmentSearchAndFilters', () => ({
  AmendmentSearchAndFilters: ({ actions }: { actions?: ReactNode }) => (
    <div data-testid="amendment-search-and-filters">{actions}</div>
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
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

  it('navigates to amendment creation through a stable action when authorized', () => {
    const { container } = render(
      <GroupAmendmentsPageView
        groupId="group-1"
        groupName="Group One"
        t={(key: string) => key}
        canCreate={() => true}
        groupedAmendments={[]}
        filters={{}}
        showFilters={false}
        hasActiveFilters={false}
        updateFilter={vi.fn()}
        clearFilter={vi.fn()}
        setShowFilters={vi.fn()}
      />
    );
    const action = container.querySelector<HTMLElement>(
      '[data-action-id="groups.amendments.navigate.create"]'
    )!;
    action.focus();
    expect(document.activeElement).toBe(action);
    expect(action.closest('a')?.getAttribute('href')).toBe('/create/amendment');
  });
});

/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AmendmentGroupsView } from '../AmendmentGroupsView';
import { GroupConflictDialog } from '../GroupConflictPanel';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/timeline/ui/cards/AmendmentTimelineCard', () => ({
  AmendmentTimelineCard: () => <article data-testid="amendment" />,
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityLocalGridView: () => <div data-testid="local-grid" />,
  PolityZeroGridView: () => <div data-testid="zero-grid" />,
}));

afterEach(cleanup);

describe('group peripheral actions', () => {
  it('toggles amendment status sections through a stable action', () => {
    const onToggleSection = vi.fn();
    const { container } = render(
      <AmendmentGroupsView
        openSections={{ accepted: false, pending: false, rejected: false, withdrawn: false }}
        sectionOrder={[
          {
            key: 'pending',
            label: 'Pending',
            count: 1,
            items: [
              {
                id: 'amendment-1',
                cardAmendment: { id: 'amendment-1', title: 'Budget', status: 'pending' },
              },
            ],
          },
        ]}
        onToggleSection={onToggleSection}
        queryFilters={{ searchQuery: '', statusFilter: 'all', hashtagFilter: '' }}
      />
    );
    const action = container.querySelector<HTMLElement>(
      '[data-action-id="groups.amendments.toggle.status-section"]'
    )!;
    action.focus();
    expect(document.activeElement).toBe(action);
    fireEvent.click(action);
    expect(onToggleSection).toHaveBeenCalledWith('pending');
  });

  it('opens conflict details through a stable dialog trigger', () => {
    const { container } = render(
      <GroupConflictDialog
        response={{
          blocking: true,
          conflicts: [
            {
              kind: 'hierarchy_duplicate_path',
              blocking: true,
              summary: 'Duplicate path',
              explanation: 'The same target is reachable twice.',
              details: { users: [], groups: [], source_groups: [], paths: [] },
              resolutions: [],
            },
          ],
        }}
      />
    );
    const action = container.querySelector<HTMLElement>(
      '[data-action-id="groups.conflicts.open.details"]'
    )!;
    fireEvent.click(action);
    expect(action.getAttribute('aria-expanded')).toBe('true');
  });
});

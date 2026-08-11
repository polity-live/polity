/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ group }: { group: { name: string } }) => <article>{group.name}</article>,
}));
vi.mock('@/features/search/ui/UserSearchCard', () => ({
  UserSearchCard: ({ user }: { user: { first_name: string } }) => <span>{user.first_name}</span>,
}));
vi.mock('@/features/search/ui/GroupSearchCard', () => ({
  GroupSearchCard: ({ group }: { group: { name: string } }) => <span>{group.name}</span>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ManagementDialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ManagementDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ManagementDialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
}));

import { RelatedGroupsTabs } from '../ui/RelatedGroupsTabs';
import { GroupConflictPanel } from '../ui/GroupConflictPanel';

afterEach(cleanup);

const group = (id: string, name: string) => ({
  group: { id, name, description: '', memberships: [] },
});

describe('group relationship component flow', () => {
  it('reviews linked parent and child groups through tabs and search', () => {
    render(
      <RelatedGroupsTabs
        parentGroups={[group('parent', 'Federal Parent')]}
        childGroups={[group('child', 'Local Chapter')]}
      />
    );
    expect(screen.getByText('Federal Parent')).toBeTruthy();
    expect(screen.getByText('Local Chapter')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('pages.group.relatedGroups.searchPlaceholder'), {
      target: { value: 'local' },
    });
    expect(screen.queryByText('Federal Parent')).toBeNull();
    expect(screen.getByText('Local Chapter')).toBeTruthy();
  });

  it('explains a blocking hierarchy conflict with affected path and resolution', () => {
    render(
      <GroupConflictPanel
        response={
          {
            blocking: true,
            conflicts: [
              {
                kind: 'hierarchy_duplicate_path',
                details: {
                  groups: [{ id: 'target', name: 'Target Group' }],
                  users: [],
                  source_groups: [],
                  paths: [
                    {
                      base_group_id: 'root',
                      target_group_id: 'target',
                      group_names: ['Root Group', 'Target Group'],
                    },
                  ],
                },
                resolutions: [{ code: 'remove_duplicate_path' }],
              },
            ],
          } as any
        }
      />
    );
    expect(screen.getAllByText('Root Group -> Target Group').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Target Group').length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('removeDuplicatePath');
  });

  it('removes an unlinked relationship from every tab after the persisted rows refresh', () => {
    const view = render(
      <RelatedGroupsTabs parentGroups={[]} childGroups={[group('child', 'Chapter to unlink')]} />
    );
    expect(screen.getByText('Chapter to unlink')).toBeTruthy();
    view.rerender(<RelatedGroupsTabs parentGroups={[]} childGroups={[]} />);
    expect(screen.queryByText('Chapter to unlink')).toBeNull();
    expect(document.querySelector('[data-slot="related-groups-tabs"]')).toBeNull();
  });
});

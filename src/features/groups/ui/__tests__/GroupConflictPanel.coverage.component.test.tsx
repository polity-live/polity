/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GroupConflict } from '../../logic/groupConflict';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string, options?: { role?: string }) =>
      options?.role ? `${key}:${options.role}` : key,
  }),
}));
vi.mock('@/features/search/ui/UserSearchCard', () => ({
  UserSearchCard: ({ user }: any) => (
    <div data-testid="user-card">{user.handle ?? 'no-handle'}</div>
  ),
}));
vi.mock('@/features/search/ui/GroupSearchCard', () => ({
  GroupSearchCard: ({ group }: any) => <div data-testid="group-card">{group.name}</div>,
}));

import {
  GroupConflictDialog,
  GroupConflictPanel,
  groupConflictPanelInternals,
} from '../GroupConflictPanel';

afterEach(cleanup);

const emptyDetails = { users: [], groups: [], source_groups: [], paths: [] };

function conflict(overrides: Partial<GroupConflict> = {}): GroupConflict {
  return {
    kind: 'sibling_source_overlap',
    blocking: true,
    summary: 'Conflict',
    explanation: 'Explanation',
    details: emptyDetails,
    resolutions: [],
    ...overrides,
  };
}

describe('GroupConflictPanel branch coverage', () => {
  it('renders every detail section, fallback path label, and resolution annotation', () => {
    render(
      <GroupConflictPanel
        response={{
          blocking: true,
          conflicts: [
            conflict({
              details: {
                groups: [{ id: 'g1', name: 'Group One' }],
                users: [
                  { id: 'u1', name: 'User One', handle: 'one', avatar_url: null },
                  { id: 'u2', name: 'User Two', handle: null, avatar_url: null },
                ],
                source_groups: [{ id: 'g2', name: 'Source Group' }],
                paths: [
                  {
                    base_group_id: 'g1',
                    target_group_id: 'g2',
                    group_ids: ['g1', 'g2'],
                    group_names: ['Start', 'Target'],
                  },
                  { base_group_id: 'g3', target_group_id: 'g4', group_ids: [], group_names: [] },
                ],
              },
              resolutions: [
                {
                  code: 'contact_admin',
                  label: 'Contact',
                  description: 'Ask',
                  self_service: true,
                  required_role: 'admin',
                },
                {
                  code: 'choose_other_group',
                  label: 'Choose',
                  description: 'Choose',
                  self_service: false,
                  required_role: null,
                },
              ],
            }),
            conflict({ kind: 'permission_blocked_resolution' }),
          ],
        }}
      />
    );

    expect(screen.getAllByTestId('group-card')).toHaveLength(2);
    expect(screen.getAllByTestId('user-card').map(node => node.textContent)).toEqual([
      'one',
      'no-handle',
    ]);
    expect(screen.getAllByText('Start -> Target')).toHaveLength(2);
    expect(document.body.textContent).toContain(
      'features.groups.conflicts.panel.baseGroupFallback'
    );
    expect(document.body.textContent).toContain(
      'features.groups.conflicts.panel.targetGroupFallback'
    );
    expect(screen.getByText(/requiredRole:admin/)).toBeTruthy();
    expect(screen.getByText('features.groups.conflicts.panel.notSelfService')).toBeTruthy();
  });

  it('returns null for an empty panel and empty or absent dialogs', () => {
    const empty = { blocking: false, conflicts: [] };
    const { container, rerender } = render(<GroupConflictPanel response={empty} />);
    expect(container.innerHTML).toBe('');
    rerender(<GroupConflictDialog response={null} />);
    expect(container.innerHTML).toBe('');
    rerender(<GroupConflictDialog response={empty} />);
    expect(container.innerHTML).toBe('');
  });

  it('uses custom dialog labels and trigger presentation', () => {
    render(
      <GroupConflictDialog
        response={{ blocking: true, conflicts: [conflict()] }}
        title="Custom title"
        description="Custom description"
        triggerLabel="Open custom"
        triggerVariant="link"
        triggerSize="lg"
        className="custom-class"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Open custom' });
    expect(trigger.className).toContain('custom-class');
  });

  it('localizes coded, generic, missing, and both legacy resolution families', () => {
    const t = (key: string) => key;
    const resolve = (item: GroupConflict, index: number) =>
      groupConflictPanelInternals.getLocalizedResolution(item, index, t);

    expect(resolve(conflict(), 0)).toEqual({ label: '', description: '' });
    expect(
      resolve(
        conflict({
          resolutions: [{ code: undefined, label: '', description: '', self_service: false }],
        }),
        0
      ).label
    ).toContain('.generic.label');
    expect(
      resolve(
        conflict({
          resolutions: [
            { code: 'clean_source_groups', label: '', description: '', self_service: false },
          ],
        }),
        0
      ).label
    ).toContain('.cleanSourceGroups.label');

    const legacy = (kind: GroupConflict['kind'], count: number) =>
      conflict({
        kind,
        resolutions: Array.from({ length: count }, () => ({
          label: '',
          description: '',
          self_service: false,
        })),
      });
    expect(resolve(legacy('hierarchy_member_overlap', 3), 0).label).toContain(
      '.alignMemberships.label'
    );
    expect(resolve(legacy('hierarchy_member_overlap', 3), 1).label).toContain(
      '.contactOtherGroup.label'
    );
    expect(resolve(legacy('hierarchy_member_overlap', 3), 2).label).toContain('.generic.label');
    expect(resolve(legacy('hierarchy_duplicate_path', 3), 0).label).toContain(
      '.removeDuplicatePath.label'
    );
    expect(resolve(legacy('hierarchy_duplicate_path', 3), 1).label).toContain(
      '.contactResponsibleGroup.label'
    );
    expect(resolve(legacy('hierarchy_duplicate_path', 3), 2).label).toContain('.generic.label');
  });
});

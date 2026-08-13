/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  getParticipationDisplayRoles,
  ParticipationRoleFilterBar,
  filterParticipationsByRole,
} from '../ParticipationRoleFilterBar';
import type {
  ParticipationLike,
  ParticipationRoleLike,
} from '@/features/shared/types/participation';

const roles: ParticipationRoleLike[] = [
  { id: 'admin', name: 'Admin' },
  { id: 'moderator', name: 'Moderator' },
];

const participations: ParticipationLike[] = [
  { id: 'one', roles: [roles[0]], user: { first_name: 'Ada' } },
  { id: 'two', roles: [roles[1]], user: { first_name: 'Grace' } },
  { id: 'three', roles: [], user: { first_name: 'Linus' } },
];

describe('ParticipationRoleFilterBar', () => {
  it('filters participations by selected role ids', () => {
    expect(filterParticipationsByRole(participations, [])).toHaveLength(3);
    expect(filterParticipationsByRole(participations, ['admin']).map(item => item.id)).toEqual([
      'one',
    ]);
    expect(
      filterParticipationsByRole(participations, ['admin', 'moderator']).map(item => item.id)
    ).toEqual(['one', 'two']);
  });

  it('filters participations by elected display roles', () => {
    const electedRole = { id: 'chair', name: 'Chair' };

    expect(
      filterParticipationsByRole(
        [
          ...participations,
          {
            id: 'four',
            roles: [],
            elected_roles: [electedRole],
            user: { first_name: 'Katherine' },
          },
        ],
        ['chair']
      ).map(item => item.id)
    ).toEqual(['four']);
  });

  it('normalizes legacy roles and deduplicates elected roles', () => {
    const role = { id: 'legacy', name: '' };
    expect(getParticipationDisplayRoles({ id: 'one', role, elected_roles: [role] })).toEqual([
      role,
    ]);
    expect(getParticipationDisplayRoles({ id: 'two' })).toEqual([]);
  });

  it('toggles colored role filter buttons', () => {
    const onSelectedRoleIdsChange = vi.fn();

    const { container, rerender } = render(
      <ParticipationRoleFilterBar
        roles={roles}
        selectedRoleIds={[]}
        onSelectedRoleIdsChange={onSelectedRoleIdsChange}
      />
    );

    const allRolesButton = screen.getByRole('button', { name: 'All roles' });
    const adminButton = screen.getByRole('button', { name: 'Admin' });
    const roleFilter = container.querySelector('[data-slot="participation-role-filter"]');

    expect(screen.queryByText(/^Roles?$/)).toBeNull();
    expect(roleFilter?.firstElementChild).toBe(allRolesButton);
    expect(allRolesButton.getAttribute('aria-pressed')).toBe('true');
    expect(allRolesButton.getAttribute('data-active')).toBe('true');
    expect(allRolesButton.className).toContain('bg-primary');
    expect(adminButton.getAttribute('aria-pressed')).toBe('false');
    expect(adminButton.getAttribute('data-active')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(onSelectedRoleIdsChange).toHaveBeenCalledWith(['admin']);

    fireEvent.click(screen.getByRole('button', { name: 'All roles' }));
    expect(onSelectedRoleIdsChange).toHaveBeenCalledWith([]);

    rerender(
      <ParticipationRoleFilterBar
        roles={roles}
        selectedRoleIds={['admin']}
        onSelectedRoleIdsChange={onSelectedRoleIdsChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Admin' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Admin' }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('button', { name: 'Admin' }).className).toContain('bg-primary');

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(onSelectedRoleIdsChange).toHaveBeenLastCalledWith([]);
  });

  it('renders no roles as null and supports labels and fallback names', () => {
    expect(
      render(
        <ParticipationRoleFilterBar
          roles={[]}
          selectedRoleIds={[]}
          onSelectedRoleIdsChange={vi.fn()}
        />
      ).container.firstChild
    ).toBeNull();
    render(
      <ParticipationRoleFilterBar
        roles={[{ id: 'unknown', name: '' }]}
        selectedRoleIds={[]}
        onSelectedRoleIdsChange={vi.fn()}
        label="Filter roles"
      />
    );
    expect(screen.getByText('Filter roles')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Role' })).toBeTruthy();
  });
});

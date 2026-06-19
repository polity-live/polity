/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
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

  it('toggles neutral role filter chips', () => {
    const onSelectedRoleIdsChange = vi.fn();

    render(
      <ParticipationRoleFilterBar
        roles={roles}
        selectedRoleIds={[]}
        onSelectedRoleIdsChange={onSelectedRoleIdsChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(onSelectedRoleIdsChange).toHaveBeenCalledWith(['admin']);

    fireEvent.click(screen.getByRole('button', { name: 'All roles' }));
    expect(onSelectedRoleIdsChange).toHaveBeenCalledWith([]);
  });
});

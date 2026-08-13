/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logic/buildMembershipRightsSummary', () => ({
  getMembershipRoleSummary: (membership: any) => membership.roleSummary ?? '',
  getMembershipDisplayRoles: (membership: any) => membership.displayRoles ?? [],
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: () => 'Unknown user',
}));

import { useMembershipSearch } from '../useMembershipSearch';

function membership(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    status: 'active',
    user: { first_name: id, last_name: 'User', handle: id },
    roleSummary: '',
    displayRoles: [],
    ...overrides,
  } as any;
}

describe('useMembershipSearch classification', () => {
  it('returns the original list for blank search and classifies default statuses and roles', () => {
    const rows = [
      membership('Zed', { status: 'pending' }),
      membership('Amy', { status: 'requested' }),
      membership('Bob', { status: 'active' }),
      membership('Cara', { status: 'member' }),
      membership('Dan', {
        status: 'inactive',
        displayRoles: [{ name: 'Board Member' }],
      }),
      membership('Eve', { status: 'invited' }),
      membership('Noah', { status: null, displayRoles: [{ name: null }] }),
    ];
    const { result } = renderHook(() =>
      useMembershipSearch(rows, '   ', { field: 'user', direction: 'asc' })
    );

    expect(result.current.filteredMemberships).toBe(rows);
    expect(result.current.pendingRequests.map(row => row.id)).toEqual(['Amy', 'Zed']);
    expect(result.current.activeMembers.map(row => row.id)).toEqual(['Bob', 'Cara', 'Dan']);
    expect(result.current.pendingInvitations.map(row => row.id)).toEqual(['Eve']);
  });

  it('supports custom active statuses and roles including empty option sets', () => {
    const rows = [
      membership('Approved', { status: 'APPROVED' }),
      membership('Chair', { status: 'inactive', displayRoles: [{ name: 'CHAIR' }] }),
      membership('Active', { status: 'active' }),
    ];
    const custom = renderHook(() =>
      useMembershipSearch(
        rows,
        '',
        { field: 'user', direction: 'asc' },
        {
          activeStatuses: ['Approved'],
          activeRoleNames: ['Chair'],
        }
      )
    );
    expect(custom.result.current.activeMembers.map(row => row.id)).toEqual(['Approved', 'Chair']);
    custom.unmount();

    const empty = renderHook(() =>
      useMembershipSearch(
        rows,
        '',
        { field: 'user', direction: 'asc' },
        {
          activeStatuses: [],
          activeRoleNames: [],
        }
      )
    );
    expect(empty.result.current.activeMembers).toEqual([]);
  });
});

describe('useMembershipSearch filtering', () => {
  it('matches each searchable field and removes non-matches', () => {
    const rows = [
      membership('name', {
        user: { first_name: 'Needle', last_name: null, handle: 'other' },
      }),
      membership('handle', {
        user: { first_name: null, last_name: null, handle: 'NEEDLE-handle' },
      }),
      membership('role', { user: null, roleSummary: 'Needle Role' }),
      membership('status', { user: {}, status: 'needle-status' }),
      membership('part', { user: {}, status: null, partGroup: { name: 'Needle Part' } }),
      membership('base', { user: {}, baseGroup: { name: 'Needle Base' } }),
      membership('provenance', { user: {}, provenanceBucketLabel: 'Needle Origin' }),
      membership('none', {
        user: {},
        status: null,
        partGroup: null,
        baseGroup: null,
        provenanceBucketLabel: null,
      }),
    ];
    const { result } = renderHook(() =>
      useMembershipSearch(rows, 'NEEDLE', { field: 'user', direction: 'asc' })
    );
    expect(result.current.filteredMemberships.map(row => row.id).sort()).toEqual([
      'base',
      'handle',
      'name',
      'part',
      'provenance',
      'role',
      'status',
    ]);
  });
});

describe('useMembershipSearch sorting', () => {
  it('sorts by name ascending and descending with handle and unknown-user fallbacks', () => {
    const rows = [
      membership('full', { user: { first_name: 'Beta', last_name: 'Person', handle: 'z' } }),
      membership('handle', { user: { first_name: null, last_name: null, handle: 'Alpha' } }),
      membership('unknown', { user: null }),
    ];
    const ascending = renderHook(() =>
      useMembershipSearch(rows, '', { field: 'user', direction: 'asc' })
    );
    expect(ascending.result.current.activeMembers.map(row => row.id)).toEqual([
      'handle',
      'full',
      'unknown',
    ]);
    ascending.unmount();

    const descending = renderHook(() =>
      useMembershipSearch(rows, '', { field: 'user', direction: 'desc' })
    );
    expect(descending.result.current.activeMembers.map(row => row.id)).toEqual([
      'unknown',
      'full',
      'handle',
    ]);
  });

  it('sorts distinct roles and falls back to names for equal roles', () => {
    const rows = [
      membership('beta', { user: { first_name: 'Beta' }, roleSummary: 'Member' }),
      membership('admin', { user: { first_name: 'Zed' }, roleSummary: 'Admin' }),
      membership('alpha', { user: { first_name: 'Alpha' }, roleSummary: 'Member' }),
    ];
    const ascending = renderHook(() =>
      useMembershipSearch(rows, '', { field: 'role', direction: 'asc' })
    );
    expect(ascending.result.current.activeMembers.map(row => row.id)).toEqual([
      'admin',
      'alpha',
      'beta',
    ]);
    ascending.unmount();

    const descending = renderHook(() =>
      useMembershipSearch(rows, '', { field: 'role', direction: 'desc' })
    );
    expect(descending.result.current.activeMembers.map(row => row.id)).toEqual([
      'beta',
      'alpha',
      'admin',
    ]);
  });
});

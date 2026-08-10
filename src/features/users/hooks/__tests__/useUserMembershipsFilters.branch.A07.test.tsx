/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/logic/membershipRoleHelpers', () => ({
  getMembershipRoleNames: (record: { testRoles?: string[] }) => record.testRoles ?? [],
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

import { useUserMembershipsFilters } from '../useUserMembershipsFilters';

afterEach(cleanup);

const record = (id: string, status: string, relation: Record<string, unknown> = {}) =>
  ({ id, status, ...relation }) as never;

describe('useUserMembershipsFilters branch campaign A07', () => {
  it('searches every relation field and fallback while retaining status partitions', () => {
    const memberships = [
      record('group-name', 'invited', { group: { name: 'Alpha', description: '' } }),
      record('group-description', 'active', {
        group: { name: 'Other', description: 'Beta description' },
      }),
      record('group-role', 'member', {
        group: { name: 'Other', description: '' },
        testRoles: ['Gamma role'],
      }),
      record('group-status', 'admin', { group: null }),
      record('group-requested', 'requested', {}),
      record('group-other', 'inactive', { status: undefined }),
    ];
    const participations = [
      record('event-title', 'invited', { event: { title: 'Delta event' } }),
      record('event-role', 'active', { event: null, testRoles: ['Epsilon role'] }),
      record('event-status', 'member', { event: {}, testRoles: [] }),
      record('event-admin', 'admin'),
      record('event-confirmed', 'confirmed'),
      record('event-requested', 'requested'),
      record('event-other', 'inactive', { status: undefined }),
    ];
    const collaborations = [
      record('amendment-title', 'invited', { amendment: { title: 'Zeta proposal' } }),
      record('amendment-role', 'member', { amendment: null, testRoles: ['Eta editor'] }),
      record('amendment-status', 'admin', { amendment: {} }),
      record('amendment-requested', 'requested'),
      record('amendment-other', 'inactive', { status: undefined }),
    ];
    const blogRelations = [
      record('blog-title', 'invited', { blog: { title: 'Theta journal' } }),
      record('blog-role', 'writer', { blog: null, testRoles: ['Iota author'] }),
      record('blog-status', 'owner', { blog: {} }),
      record('blog-member', 'member'),
      record('blog-requested', 'requested'),
      record('blog-other', 'inactive', { status: undefined }),
    ];

    const { result } = renderHook(() =>
      useUserMembershipsFilters({
        memberships,
        participations,
        collaborations,
        blogRelations,
      } as never)
    );

    expect(result.current.filteredMemberships).toBe(memberships);
    expect(result.current.filteredParticipations).toBe(participations);
    expect(result.current.filteredCollaborations).toBe(collaborations);
    expect(result.current.filteredBlogRelations).toBe(blogRelations);
    expect(result.current.membershipsByStatus.active.map(item => item.id)).toEqual([
      'group-description',
      'group-role',
      'group-status',
    ]);
    expect(result.current.participationsByStatus.active).toHaveLength(4);
    expect(result.current.collaborationsByStatus.active).toHaveLength(2);
    expect(result.current.blogRelationsByStatus.active).toHaveLength(3);

    const searches: [string, keyof typeof result.current, string][] = [
      ['alpha', 'filteredMemberships', 'group-name'],
      ['beta', 'filteredMemberships', 'group-description'],
      ['gamma', 'filteredMemberships', 'group-role'],
      ['admin', 'filteredMemberships', 'group-status'],
      ['delta', 'filteredParticipations', 'event-title'],
      ['epsilon', 'filteredParticipations', 'event-role'],
      ['member', 'filteredParticipations', 'event-status'],
      ['zeta', 'filteredCollaborations', 'amendment-title'],
      ['eta', 'filteredCollaborations', 'amendment-role'],
      ['admin', 'filteredCollaborations', 'amendment-status'],
      ['theta', 'filteredBlogRelations', 'blog-title'],
      ['iota', 'filteredBlogRelations', 'blog-role'],
      ['owner', 'filteredBlogRelations', 'blog-status'],
    ];
    for (const [query, key, id] of searches) {
      act(() => result.current.setSearchQuery(query));
      expect((result.current[key] as readonly { id: string }[]).some(item => item.id === id)).toBe(
        true
      );
    }

    act(() => result.current.setSearchQuery('no match anywhere'));
    expect(result.current.filteredMemberships).toEqual([]);
    expect(result.current.filteredParticipations).toEqual([]);
    expect(result.current.filteredCollaborations).toEqual([]);
    expect(result.current.filteredBlogRelations).toEqual([]);
    act(() => result.current.setSearchQuery('   '));
    expect(result.current.filteredMemberships).toBe(memberships);
  });
});

/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useUserMembershipsFilters } from '../useUserMembershipsFilters';

afterEach(() => {
  cleanup();
});

describe('useUserMembershipsFilters', () => {
  it('searches event, amendment, and blog rows by role names', () => {
    const { result } = renderHook(() =>
      useUserMembershipsFilters({
        memberships: [],
        participations: [
          {
            id: 'participant-1',
            status: 'member',
            event: { id: 'event-1', title: 'Assembly' },
            participant_roles: [{ role: { id: 'role-organizer', name: 'Organizer' } }],
          },
        ] as never,
        collaborations: [
          {
            id: 'collaboration-1',
            status: 'member',
            amendment: { id: 'amendment-1', title: 'A1' },
            role: { id: 'role-collaborator', name: 'Collaborator' },
          },
        ] as never,
        blogRelations: [
          {
            id: 'blogger-1',
            status: 'writer',
            blog: { id: 'blog-1', title: 'Field Notes' },
            role: { id: 'role-editor', name: 'Editor' },
          },
        ] as never,
      })
    );

    act(() => result.current.setSearchQuery('organizer'));
    expect(result.current.filteredParticipations).toHaveLength(1);
    expect(result.current.filteredCollaborations).toHaveLength(0);
    expect(result.current.filteredBlogRelations).toHaveLength(0);

    act(() => result.current.setSearchQuery('collaborator'));
    expect(result.current.filteredParticipations).toHaveLength(0);
    expect(result.current.filteredCollaborations).toHaveLength(1);
    expect(result.current.filteredBlogRelations).toHaveLength(0);

    act(() => result.current.setSearchQuery('editor'));
    expect(result.current.filteredParticipations).toHaveLength(0);
    expect(result.current.filteredCollaborations).toHaveLength(0);
    expect(result.current.filteredBlogRelations).toHaveLength(1);
  });
});

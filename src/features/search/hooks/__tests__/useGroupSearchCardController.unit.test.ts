import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

import { useGroupSearchCardController } from '../useGroupSearchCardController';
import type { SearchGroup } from '../../types/search.types';

function searchGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    name: 'Group One',
    description: 'Description',
    member_count: null,
    memberships: [],
    events: [],
    amendments: [],
    group_hashtags: [],
    ...overrides,
  } as unknown as SearchGroup;
}

beforeEach(() => {
  mocks.user = { id: 'user-1' };
});

describe('useGroupSearchCardController', () => {
  it('maps a search group membership with its primary role and explicit status', () => {
    const result = useGroupSearchCardController({
      group: searchGroup({
        member_count: 9,
        events: [{ id: 'event-1' }],
        amendments: [{ id: 'amendment-1' }],
        group_hashtags: [{ hashtag: { id: 'hashtag-1', tag: 'democracy' } }],
        memberships: [
          {
            user: { id: 'user-1' },
            status: 'admin',
            roles: [{ id: 'role-1', name: 'Chair', sort_order: 1 }],
          },
        ],
      }),
    });

    expect(result.group).toMatchObject({
      id: 'group-1',
      name: 'Group One',
      description: 'Description',
      memberCount: 9,
      eventCount: 1,
      amendmentCount: 1,
      hashtags: [{ id: 'hashtag-1', tag: 'democracy' }],
      membershipStatus: 'admin',
    });
  });

  it('uses Member and the generic member status when a matching membership has no role or status', () => {
    const result = useGroupSearchCardController({
      group: searchGroup({ memberships: [{ user: { id: 'user-1' }, status: null }] }),
    });

    expect(result.group.memberCount).toBe(1);
    expect(result.group.membershipStatus).toBe('member');
  });

  it('maps an unmatched or unauthenticated user to Visitor without a membership status', () => {
    const unmatched = useGroupSearchCardController({
      group: searchGroup({
        name: null,
        description: null,
        events: undefined,
        amendments: undefined,
        memberships: [{ user: { id: 'other-user' } }],
      }),
    });
    expect(unmatched.group).toMatchObject({
      name: '',
      description: undefined,
      eventCount: 0,
      amendmentCount: 0,
      membershipStatus: null,
    });

    mocks.user = null;
    expect(
      useGroupSearchCardController({
        group: searchGroup({ memberships: [{ user: undefined }] }),
      }).group.membershipStatus
    ).toBeNull();
  });

  it('maps the basic group DTO with explicit and fallback field values', () => {
    expect(
      useGroupSearchCardController({
        group: {
          id: 'basic-1',
          name: 'Basic Group',
          description: 'Basic description',
          member_count: 3,
          event_count: 2,
          amendment_count: 1,
        },
      }).group
    ).toEqual({
      id: 'basic-1',
      name: 'Basic Group',
      description: 'Basic description',
      memberCount: 3,
      eventCount: 2,
      amendmentCount: 1,
    });

    expect(
      useGroupSearchCardController({
        group: {
          id: 'basic-2',
          name: null,
          description: null,
          member_count: null,
          event_count: null,
          amendment_count: null,
        },
      }).group
    ).toEqual({
      id: 'basic-2',
      name: '',
      description: undefined,
      memberCount: 0,
      eventCount: 0,
      amendmentCount: 0,
    });
  });

  it('treats a non-array memberships property as a basic runtime payload', () => {
    expect(
      useGroupSearchCardController({
        group: { id: 'runtime-1', memberships: null } as never,
      }).group
    ).toMatchObject({ id: 'runtime-1', memberCount: 0 });
  });
});

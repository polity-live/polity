/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchAmendment } from '../../types/search.types';
import { useAmendmentSearchCardController } from '../useAmendmentSearchCardController';

const useAuthMock = vi.fn();

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

function amendment(overrides: Record<string, unknown> = {}): SearchAmendment {
  return {
    id: 17,
    title: null,
    reason: null,
    upvotes: 0,
    downvotes: 0,
    group: null,
    current_process_run: null,
    collaborators: null,
    amendment_hashtags: [],
    change_requests: null,
    ...overrides,
  } as unknown as SearchAmendment;
}

describe('useAmendmentSearchCardController branch matrix', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
  });

  it.each([
    ['ADMIN', 'admin'],
    ['active', 'member'],
    ['member', 'member'],
    ['invited', 'invited'],
    ['requested', 'requested'],
    ['revoked', undefined],
  ])('normalizes collaboration status %s', (status, expected) => {
    const { result } = renderHook(() =>
      useAmendmentSearchCardController({
        amendment: amendment({
          collaborators: [{ status, user: { id: 'user-1' } }],
        }),
      })
    );
    expect(result.current.amendment.collaborationStatus).toBe(expected);
  });

  it('maps the complete amendment card view model', () => {
    const { result } = renderHook(() =>
      useAmendmentSearchCardController({
        amendment: amendment({
          title: 'Safer streets',
          reason: 'Safety',
          upvotes: 9,
          downvotes: 4,
          group: { id: 'group-1', name: 'Mobility' },
          current_process_run: {
            branches: [{ id: 'branch-1', editing_mode: 'edit', created_at: 1 }],
          },
          collaborators: [{ status: 'member', user: { id: 'user-1' } }, { status: 'member' }],
          amendment_hashtags: [{ hashtag: { tag: 'traffic' } }],
          change_requests: [{ id: 'change-1' }],
        }),
      })
    );

    expect(result.current.amendment).toMatchObject({
      id: '17',
      title: 'Safer streets',
      subtitle: 'Mobility',
      description: 'Safety',
      supportCount: 5,
      groupName: 'Mobility',
      groupId: 'group-1',
      collaboratorCount: 2,
      changeRequestCount: 1,
      collaborationStatus: 'member',
    });
  });

  it('supplies safe empty values without a user, relations, votes or process branches', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() =>
      useAmendmentSearchCardController({ amendment: amendment() })
    );

    expect(result.current.amendment).toMatchObject({
      id: '17',
      title: '',
      subtitle: undefined,
      description: undefined,
      supportCount: 0,
      groupName: undefined,
      groupId: undefined,
      collaboratorCount: 0,
      changeRequestCount: undefined,
      collaborationStatus: undefined,
      branchStatuses: [],
    });
  });
});

// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAmendmentSearchCardController } from '../useAmendmentSearchCardController';
import type { SearchAmendment } from '../../types/search.types';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

function amendmentWithCollaborationStatus(status: string): SearchAmendment {
  return {
    id: 'amendment-1',
    title: 'Safer Streets',
    reason: null,
    current_process_run: {
      branches: [{ id: 'branch-1', editing_mode: 'edit', created_at: 1 }],
    },
    collaborators: [
      {
        id: 'collab-1',
        user_id: 'user-1',
        status,
        user: { id: 'user-1' },
      },
    ],
    amendment_hashtags: [],
    change_requests: [],
  } as unknown as SearchAmendment;
}

describe('useAmendmentSearchCardController', () => {
  it('preserves requested collaboration status from search relations', () => {
    const { result } = renderHook(() =>
      useAmendmentSearchCardController({
        amendment: amendmentWithCollaborationStatus('requested'),
      })
    );

    expect(result.current.amendment.collaborationStatus).toBe('requested');
  });

  it('normalizes legacy active collaborator status to member', () => {
    const { result } = renderHook(() =>
      useAmendmentSearchCardController({
        amendment: amendmentWithCollaborationStatus('collaborator'),
      })
    );

    expect(result.current.amendment.collaborationStatus).toBe('member');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/change-requests/logic/changeRequestNumbering', async importOriginal => {
  const actual = await importOriginal<
    typeof import('@/features/change-requests/logic/changeRequestNumbering')
  >();
  return {
    ...actual,
    formatChangeRequestCrId: vi.fn(() => null),
  };
});

import { amendmentSharedMutators } from '../shared-mutators';

describe('amendmentSharedMutators CR label fallback', () => {
  it('formats the derived positive sequence when the canonical formatter declines it', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'amendment-1',
          discussions: [{ id: 'suggestion-1' }],
        })
        .mockResolvedValueOnce([]),
      mutate: {
        change_request: { insert: vi.fn() },
        amendment: { update: vi.fn() },
      },
    };

    await amendmentSharedMutators.createChangeRequest.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: {
        id: 'cr-1',
        amendment_id: 'amendment-1',
        process_branch_id: null,
        discussion_id: 'suggestion-1',
        title: 'draft',
        status: 'open',
        source_type: null,
        changed_character_count: 1,
        voting_status: 'open',
      } as never,
    });

    expect(tx.mutate.change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'CR-1', branch_sequence_number: 1 })
    );
  });
});

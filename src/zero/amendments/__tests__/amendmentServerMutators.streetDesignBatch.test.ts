import { afterEach, describe, expect, it, vi } from 'vitest';
import { amendmentServerMutators } from '../server-mutators';

function request(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    amendment_id: 'amendment-1',
    process_branch_id: 'branch-1',
    title: null,
    description: 'Street design update',
    status: 'open',
    reason: null,
    source_type: 'street_design_object',
    source_id: `object-${id}`,
    source_title: 'Tree',
    change_type: 'update',
    original_text: 'before',
    new_text: 'after',
    original_properties: null,
    new_properties: null,
    changed_character_count: 10,
    voting_status: 'open',
    voting_deadline: null,
    voting_majority_type: null,
    quorum_required: null,
    ...overrides,
  } as unknown as Parameters<typeof amendmentServerMutators.createChangeRequest.fn>[0]['args'];
}

afterEach(() => vi.restoreAllMocks());

describe('amendmentServerMutators.createStreetDesignChangeRequests', () => {
  it('rejects new legacy scene change requests before authorization or persistence', async () => {
    await expect(
      amendmentServerMutators.createChangeRequest.fn({
        tx: {} as never,
        ctx: { userID: 'user-1' } as never,
        args: request('scene-cr', { source_type: 'street_design_scene' }),
      })
    ).rejects.toThrow('scene change requests are no longer supported');
  });

  it('validates the complete batch before creating any CR', async () => {
    const createChangeRequest = vi
      .spyOn(amendmentServerMutators.createChangeRequest, 'fn')
      .mockResolvedValue(undefined as never);

    await expect(
      amendmentServerMutators.createStreetDesignChangeRequests.fn({
        tx: {} as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          amendment_id: 'amendment-1',
          process_branch_id: 'branch-1',
          requests: [
            request('cr-street'),
            request('cr-document', { source_type: 'document_suggestion' }),
          ],
        },
      })
    ).rejects.toThrow('only support object');

    expect(createChangeRequest).not.toHaveBeenCalled();
  });

  it('creates every validated CR through the authoritative server path', async () => {
    const createChangeRequest = vi
      .spyOn(amendmentServerMutators.createChangeRequest, 'fn')
      .mockResolvedValue(undefined as never);
    const tx = {} as never;
    const ctx = { userID: 'user-1' } as never;
    const requests = [request('cr-1'), request('cr-2')];

    await amendmentServerMutators.createStreetDesignChangeRequests.fn({
      tx,
      ctx,
      args: {
        amendment_id: 'amendment-1',
        process_branch_id: 'branch-1',
        requests,
      },
    });

    expect(createChangeRequest).toHaveBeenCalledTimes(2);
    expect(createChangeRequest).toHaveBeenNthCalledWith(1, { tx, ctx, args: requests[0] });
    expect(createChangeRequest).toHaveBeenNthCalledWith(2, { tx, ctx, args: requests[1] });
  });
});

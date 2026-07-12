import { afterEach, describe, expect, it, vi } from 'vitest';
import { amendmentSharedMutators } from '../shared-mutators';

function streetRequest(id: string) {
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
  } as unknown as Parameters<typeof amendmentSharedMutators.createChangeRequest.fn>[0]['args'];
}

afterEach(() => vi.restoreAllMocks());

describe('amendmentSharedMutators.createStreetDesignChangeRequests', () => {
  it('creates every request inside the batch mutator transaction', async () => {
    const createChangeRequest = vi
      .spyOn(amendmentSharedMutators.createChangeRequest, 'fn')
      .mockResolvedValue(undefined as never);
    const tx = {} as never;
    const ctx = { userID: 'user-1' } as never;
    const requests = [streetRequest('cr-1'), streetRequest('cr-2')];

    await amendmentSharedMutators.createStreetDesignChangeRequests.fn({
      tx,
      ctx,
      args: {
        amendment_id: 'amendment-1',
        process_branch_id: 'branch-1',
        requests,
      },
    });

    expect(createChangeRequest).toHaveBeenCalledTimes(2);
    expect(createChangeRequest).toHaveBeenNthCalledWith(1, {
      tx,
      ctx,
      args: requests[0],
    });
    expect(createChangeRequest).toHaveBeenNthCalledWith(2, {
      tx,
      ctx,
      args: requests[1],
    });
  });
});

describe('amendmentSharedMutators street-design edit context', () => {
  it('does not persist the process branch authorization context', async () => {
    const insert = vi.fn();
    const update = vi.fn();
    const tx = {
      mutate: {
        amendment_street_design: { insert, update },
      },
    } as never;
    const ctx = { userID: 'user-1' } as never;

    await amendmentSharedMutators.createStreetDesign.fn({
      tx,
      ctx,
      args: {
        id: 'street-design-1',
        amendment_id: 'amendment-1',
        process_branch_id: 'branch-1',
        title: 'Street design',
        bbox: null,
        center_lat: 52.52,
        center_lon: 13.405,
        osm_snapshot: null,
        design_state: null,
        currency: 'EUR',
        estimated_total_cost_minor: 0,
        cost_catalog_version: null,
        cost_summary: null,
      },
    });
    await amendmentSharedMutators.updateStreetDesign.fn({
      tx,
      ctx,
      args: {
        id: 'street-design-1',
        process_branch_id: 'branch-1',
        title: 'Updated',
      },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ process_branch_id: expect.anything() })
    );
    expect(update).toHaveBeenCalledWith(
      expect.not.objectContaining({ process_branch_id: expect.anything() })
    );
  });
});

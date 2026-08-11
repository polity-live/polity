import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CityDesignObject, CityDesignStateV1 } from '@/features/amendments/city-design/types';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { createCityDesignChangeRequestPayloads } from '@/features/amendments/city-design/logic/cityDesignChangeRequestDiff';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, _params?: unknown, fallback?: string) => fallback ?? 'Change Request',
}));

import { resolveChangeRequestByVoteResult } from '../server-resolution';

function object(overrides: Partial<CityDesignObject> = {}): CityDesignObject {
  return {
    id: 'object-1',
    type: 'tree',
    geometry: {
      kind: 'point',
      point: { x: 1, z: 2 },
      rotation: 0,
    },
    properties: { species: 'oak' },
    cost: {
      rule: 'per_item',
      currency: 'EUR',
      suggestedUnitCostMinor: 100_00,
    },
    ...overrides,
  };
}

function state(objects: CityDesignObject[]): CityDesignStateV1 {
  return {
    ...createEmptyCityDesignState(),
    objects,
  };
}

function createTx(rows: unknown[]) {
  const remainingRows = [...rows];

  return {
    run: vi.fn(async () => {
      if (remainingRows.length === 0) {
        throw new Error('Unexpected query');
      }
      return remainingRows.shift();
    }),
    mutate: {
      amendment_city_design: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      change_request: {
        update: vi.fn(),
      },
    },
  };
}

describe('resolveChangeRequestByVoteResult for CityDesign', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('applies a passed city design insert to design_state', async () => {
    const baseDesign = state([]);
    const inserted = object();
    const [payload] = createCityDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      cityDesignId: 'city-design-1',
      baseDesign,
      draftDesign: state([inserted]),
      createId: () => 'cr-1',
    });
    const tx = createTx([
      payload,
      {
        id: 'city-design-1',
        amendment_id: 'amendment-1',
        design_state: baseDesign,
      },
    ]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'user-1' },
      changeRequestId: 'cr-1',
      voteResult: 'passed',
      now: 1_000,
    });

    expect(tx.mutate.amendment_city_design.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'city-design-1',
        design_state: expect.objectContaining({
          objects: [expect.objectContaining({ id: 'object-1' })],
        }),
      })
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-1',
        status: 'accepted',
        voting_status: 'completed',
        resolved_in_mode: 'event_final_closing_vote',
      })
    );
  });

  it('does not mutate design_state for a rejected city design change request', async () => {
    const baseDesign = state([]);
    const [payload] = createCityDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      cityDesignId: 'city-design-1',
      baseDesign,
      draftDesign: state([object()]),
      createId: () => 'cr-1',
    });
    const tx = createTx([
      payload,
      {
        id: 'city-design-1',
        amendment_id: 'amendment-1',
        design_state: baseDesign,
      },
    ]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'user-1' },
      changeRequestId: 'cr-1',
      voteResult: 'rejected',
      now: 1_000,
    });

    expect(tx.mutate.amendment_city_design.update).not.toHaveBeenCalled();
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-1',
        status: 'rejected',
        voting_status: 'completed',
      })
    );
  });

  it('applies a passed price CR fieldwise and recomputes persisted costs', async () => {
    const original = object();
    const proposedPrice = object({
      cost: { ...original.cost, customUnitCostMinor: 12_345 },
    });
    const concurrentlyChanged = object({
      geometry: { kind: 'point', point: { x: 9, z: 8 }, rotation: 45 },
    });
    const [payload] = createCityDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      cityDesignId: 'city-design-1',
      baseDesign: state([original]),
      draftDesign: state([proposedPrice]),
      createId: () => 'cr-price',
    });
    const tx = createTx([
      payload,
      {
        id: 'city-design-1',
        amendment_id: 'amendment-1',
        design_state: state([concurrentlyChanged]),
      },
    ]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'user-1' },
      changeRequestId: 'cr-price',
      voteResult: 'passed',
      now: 1_000,
    });

    expect(tx.mutate.amendment_city_design.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'city-design-1',
        estimated_total_cost_minor: 12_345,
        design_state: expect.objectContaining({
          objects: [
            expect.objectContaining({
              geometry: concurrentlyChanged.geometry,
              cost: expect.objectContaining({ customUnitCostMinor: 12_345 }),
            }),
          ],
        }),
      })
    );
  });

  it('inserts a missing design using snapshot context and the translated title fallback', async () => {
    const [generatedPayload] = createCityDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      cityDesignId: 'city-design-new',
      baseDesign: state([]),
      draftDesign: state([object()]),
      createId: () => 'cr-insert-new-design',
    });
    const payload = { ...generatedPayload, source_title: null, title: null };
    const tx = createTx([payload, null, null]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'creator' },
      changeRequestId: payload.id,
      voteResult: 'passed',
      now: 2_000,
    });

    expect(tx.mutate.amendment_city_design.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amendment_id: 'amendment-1',
        created_by_id: 'creator',
        title: 'Change Request',
        created_at: 2_000,
      })
    );
    expect(tx.mutate.amendment_city_design.update).not.toHaveBeenCalled();
  });

  it('falls back from new to original design context', async () => {
    const [generatedPayload] = createCityDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      cityDesignId: 'city-design-1',
      baseDesign: state([]),
      draftDesign: state([object()]),
      createId: () => 'cr-original-context',
    });
    const newProperties = { ...(generatedPayload.new_properties as Record<string, unknown>) };
    const designContext = newProperties.designContext;
    delete newProperties.designContext;
    const payload = {
      ...generatedPayload,
      new_properties: newProperties,
      original_properties: { cityDesignId: 'city-design-1', designContext },
    };
    const tx = createTx([
      payload,
      { id: 'city-design-1', amendment_id: 'amendment-1', design_state: state([]) },
    ]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'user' },
      changeRequestId: payload.id,
      voteResult: 'passed',
      now: 1,
    });

    expect(tx.mutate.amendment_city_design.update).toHaveBeenCalledOnce();
  });

  it('uses the persisted design when no snapshot context is available', async () => {
    const [generatedPayload] = createCityDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      cityDesignId: 'city-design-1',
      baseDesign: state([]),
      draftDesign: state([object()]),
      createId: () => 'cr-no-context',
    });
    const newProperties = { ...(generatedPayload.new_properties as Record<string, unknown>) };
    delete newProperties.designContext;
    const payload = {
      ...generatedPayload,
      new_properties: newProperties,
      original_properties: null,
    };
    const tx = createTx([
      payload,
      { id: 'city-design-1', amendment_id: 'amendment-1', design_state: state([]) },
    ]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'user' },
      changeRequestId: payload.id,
      voteResult: 'passed',
      now: 1,
    });

    expect(tx.mutate.amendment_city_design.update).toHaveBeenCalledOnce();
  });

  it('falls back to amendment lookup for malformed snapshot ids', async () => {
    const [generatedPayload] = createCityDesignChangeRequestPayloads({
      amendmentId: 'amendment-1',
      cityDesignId: 'city-design-1',
      baseDesign: state([]),
      draftDesign: state([object()]),
      createId: () => 'cr-malformed-snapshot',
    });
    const payload = {
      ...generatedPayload,
      new_properties: [],
      original_properties: { cityDesignId: '' },
    };
    const tx = createTx([
      payload,
      { id: 'city-design-1', amendment_id: 'amendment-1', design_state: state([]) },
    ]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'user' },
      changeRequestId: payload.id,
      voteResult: 'rejected',
      now: 1,
    });

    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected' })
    );
  });
});

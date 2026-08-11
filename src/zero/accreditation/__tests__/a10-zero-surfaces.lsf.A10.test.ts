import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAuthenticated: vi.fn() }));

vi.mock('@rocicorp/zero', () => ({
  defineMutator: (_schema: unknown, handler: unknown) => ({ fn: handler }),
  defineQuery: (_schema: unknown, handler: unknown) => ({ fn: handler }),
}));
vi.mock('../../rbac/authorize', () => ({ requireAuthenticated: mocks.requireAuthenticated }));

function queryChain(): any {
  const chain: any = {};
  chain.where = vi.fn((...args: any[]) => {
    if (typeof args[0] === 'function') {
      args[0]({
        cmp: vi.fn(() => 'cmp'),
        exists: vi.fn((_name: string, callback: (query: any) => unknown) => {
          callback(queryChain());
          return 'exists';
        }),
        or: vi.fn((...conditions: unknown[]) => conditions),
      });
    }
    return chain;
  });
  chain.whereExists = vi.fn((_name: string, callback: (query: any) => unknown) => {
    callback(queryChain());
    return chain;
  });
  chain.related = vi.fn((_name: string, callback?: (query: any) => unknown) => {
    callback?.(queryChain());
    return chain;
  });
  chain.orderBy = vi.fn(() => chain);
  chain.one = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  return chain;
}

vi.mock('../../schema', () => ({
  zql: new Proxy({}, { get: () => queryChain() }),
}));
vi.mock('../../rbac/query-access', () => ({
  applyAgendaItemQueryAccess: (query: unknown) => query,
  applyElectionElectorOrManagerQueryAccess: (query: unknown) => query,
  applyElectionManagerQueryAccess: (query: unknown) => query,
  applyElectionQueryAccess: (query: unknown) => query,
  applyEventQueryAccess: (query: unknown) => query,
  applyGroupQueryAccess: (query: unknown) => query,
  applyRoleQueryAccess: (query: unknown) => query,
}));

import { accreditationSharedMutators } from '../shared-mutators';
import {
  delegateElectionAssignmentSelectSchema,
  eventDelegateSelectSchema,
  groupDelegateAllocationSelectSchema,
} from '../../delegates/schema';
import { electionQueries } from '../../elections/queries';

describe('A10 Zero LSF surfaces', () => {
  beforeEach(() => vi.clearAllMocks());

  it('executes accreditation optimistic/server placeholders', async () => {
    await (accreditationSharedMutators.requestAccreditation as any).fn({
      tx: { location: 'client' },
      ctx: { userID: 'user' },
    });
    await (accreditationSharedMutators.approveAccreditation as any).fn({});
    await (accreditationSharedMutators.deleteAccreditation as any).fn({
      tx: { location: 'client' },
    });
    expect(mocks.requireAuthenticated).toHaveBeenCalledOnce();
  });

  it('constructs every delegate schema surface', () => {
    expect(
      eventDelegateSelectSchema.parse({
        id: 'delegate',
        event_id: 'event',
        user_id: 'user',
        group_id: null,
        status: null,
        seat_count: 1,
        created_at: 1,
      })
    ).toBeDefined();
    expect(
      groupDelegateAllocationSelectSchema.parse({
        id: 'allocation',
        event_id: 'event',
        group_id: null,
        allocated_seats: 1,
        created_at: 1,
      })
    ).toBeDefined();
    expect(
      delegateElectionAssignmentSelectSchema.parse({
        id: 'assignment',
        target_event_id: 'event',
        source_group_id: 'group',
        allocation_id: null,
        required_seats: 1,
        confirmed_seats: 0,
        linked_event_id: null,
        status: 'pending',
        created_at: 1,
        updated_at: 1,
      })
    ).toBeDefined();
  });

  it('executes elector visibility composition callbacks', () => {
    const query = (electionQueries.electorsByElection as any).fn({
      args: { election_id: 'election' },
      ctx: { userID: 'user' },
    });
    expect(query).toBeDefined();
  });
});

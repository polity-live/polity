import { describe, expect, it } from 'vitest';
import { resultQuery } from '../../common/__tests__/query-result-harness';
import { zql } from '../../schema';

import {
  applyAccreditationQueryAccess,
  applyAgendaItemQueryAccess,
  applyAmendmentQueryAccess,
  applyBlogManagerQueryAccess,
  applyBlogQueryAccess,
  applyChangeRequestVisibilityAccess,
  applyDatasetQueryAccess,
  applyDocumentQueryAccess,
  applyElectionElectorOrManagerQueryAccess,
  applyElectionManagerQueryAccess,
  applyElectionQueryAccess,
  applyEventManagerQueryAccess,
  applyEventParticipantOrManagerQueryAccess,
  applyEventQueryAccess,
  applyGroupManagerQueryAccess,
  applyGroupMembershipSelfOrManagerQueryAccess,
  applyGroupDiscoveryQueryAccess,
  applyGroupQueryAccess,
  applyRoleQueryAccess,
  applySearchDocumentQueryAccess,
  applyStatementQueryAccess,
  applyTodoQueryAccess,
  applyTutorialRunOwnerQueryAccess,
  applyUserQueryAccess,
  applyVoteManagerQueryAccess,
  applyVoteQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
  denyAllRows,
  isAuthenticatedUserId,
  requireQueryUser,
  requireRequestedViewer,
} from '../query-access';

type Call = readonly [string, ...unknown[]];

interface EagerQuery {
  calls: Call[];
  where: (...args: unknown[]) => EagerQuery;
  whereExists: (
    relation: string,
    callback: (query: EagerQuery) => unknown,
    options?: unknown
  ) => EagerQuery;
}

function eagerQuery(calls: Call[] = []): EagerQuery {
  const query: EagerQuery = {
    calls,
    where: (...args: unknown[]) => {
      calls.push(['where', ...args]);
      if (typeof args[0] === 'function') args[0](predicateHelpers(calls));
      return query;
    },
    whereExists: (relation, callback, options) => {
      const childCalls: Call[] = [];
      calls.push(['whereExists', relation, childCalls, options]);
      callback(eagerQuery(childCalls));
      return query;
    },
  };
  return query;
}

function predicateHelpers(calls: Call[]) {
  return {
    and: (...values: unknown[]) => ['and', ...values],
    cmp: (...values: unknown[]) => ['cmp', ...values],
    exists: (relation: string, callback: (query: EagerQuery) => unknown, options?: unknown) => {
      const childCalls: Call[] = [];
      calls.push(['exists', relation, childCalls, options]);
      callback(eagerQuery(childCalls));
      return ['exists', relation];
    },
    or: (...values: unknown[]) => ['or', ...values],
  };
}

function expectQueryMutation(callback: (query: EagerQuery) => unknown) {
  const query = eagerQuery();
  expect(callback(query)).toBe(query);
  expect(query.calls.length).toBeGreaterThan(0);
  return query;
}

describe('query access authentication decision table', () => {
  it('denies every row including the nil UUID while retaining contradictory primary-key predicates', () => {
    const nilID = '00000000-0000-0000-0000-000000000000';
    const query = denyAllRows(resultQuery());
    expect(query.run([{ id: nilID }, { id: '00000000-0000-4000-8000-000000000001' }])).toEqual([]);
    const ast = (denyAllRows(zql.event) as any).ast;
    expect(ast.where).toEqual({
      type: 'and',
      conditions: [
        {
          type: 'simple',
          left: { type: 'column', name: 'id' },
          op: '=',
          right: { type: 'literal', value: nilID },
        },
        {
          type: 'simple',
          left: { type: 'column', name: 'id' },
          op: '!=',
          right: { type: 'literal', value: nilID },
        },
      ],
    });
  });

  it('classifies viewer identities and basic requested-user constraints', () => {
    expect(isAuthenticatedUserId(undefined)).toBe(false);
    expect(isAuthenticatedUserId(null)).toBe(false);
    expect(isAuthenticatedUserId('')).toBe(false);
    expect(isAuthenticatedUserId('anon')).toBe(false);
    expect(isAuthenticatedUserId('viewer')).toBe(true);

    expect(expectQueryMutation(query => denyAllRows(query)).calls).toContainEqual([
      'where',
      'id',
      '00000000-0000-0000-0000-000000000000',
    ]);
    expect(expectQueryMutation(query => requireQueryUser(query, undefined)).calls).toContainEqual([
      'where',
      'id',
      '00000000-0000-0000-0000-000000000000',
    ]);
    expect(expectQueryMutation(query => requireQueryUser(query, 'viewer')).calls).toContainEqual([
      'where',
      'user_id',
      'viewer',
    ]);
    expect(
      expectQueryMutation(query => requireQueryUser(query, 'viewer', 'owner_id')).calls
    ).toContainEqual(['where', 'owner_id', 'viewer']);

    expect(
      expectQueryMutation(query => requireRequestedViewer(query, 'viewer', undefined)).calls
    ).toContainEqual(['where', 'id', '00000000-0000-0000-0000-000000000000']);
    expect(
      expectQueryMutation(query => requireRequestedViewer(query, 'other', 'viewer')).calls
    ).toContainEqual(['where', 'id', '00000000-0000-0000-0000-000000000000']);
    expect(
      expectQueryMutation(query => requireRequestedViewer(query, 'viewer', 'viewer')).calls
    ).toContainEqual(['where', 'user_id', 'viewer']);
    expect(
      expectQueryMutation(query =>
        requireRequestedViewer(query, 'viewer', 'viewer', 'requested_by_id')
      ).calls
    ).toContainEqual(['where', 'requested_by_id', 'viewer']);
  });

  it('builds public and authenticated content predicates for every root', () => {
    const roots = [
      applyTutorialRunOwnerQueryAccess,
      applySearchDocumentQueryAccess,
      applyUserQueryAccess,
      applyGroupQueryAccess,
      applyEventQueryAccess,
      applyAmendmentQueryAccess,
      applyChangeRequestVisibilityAccess,
      applyBlogQueryAccess,
      applyTodoQueryAccess,
      applyAgendaItemQueryAccess,
      applyElectionQueryAccess,
      applyDatasetQueryAccess,
      applyVoteQueryAccess,
      applyRoleQueryAccess,
    ];

    for (const access of roots) {
      expectQueryMutation(query => access(query, undefined));
      expectQueryMutation(query => access(query, 'viewer'));
    }

    expectQueryMutation(query => applyStatementQueryAccess(query, undefined, 1_700_000_000_000));
    expectQueryMutation(query => applyStatementQueryAccess(query, 'viewer', 1_700_000_000_000));
  });

  it('builds anonymous denials and authenticated manager predicates', () => {
    for (const access of [
      applyGroupMembershipSelfOrManagerQueryAccess,
      applyEventParticipantOrManagerQueryAccess,
      applyElectionManagerQueryAccess,
      applyElectionElectorOrManagerQueryAccess,
      applyVoteManagerQueryAccess,
      applyVoteVoterOrManagerQueryAccess,
      applyAccreditationQueryAccess,
    ]) {
      expectQueryMutation(query => access(query, undefined));
      expectQueryMutation(query => access(query, 'viewer'));
    }

    expectQueryMutation(query => applyGroupManagerQueryAccess(query, undefined));
    expectQueryMutation(query => applyGroupManagerQueryAccess(query, 'viewer'));
    expectQueryMutation(query =>
      applyGroupManagerQueryAccess(query, 'viewer', 'manage_members', [
        'groups',
        'groupMemberships',
      ])
    );
    expectQueryMutation(query => applyEventManagerQueryAccess(query, undefined));
    expectQueryMutation(query => applyEventManagerQueryAccess(query, 'viewer'));
    expectQueryMutation(query =>
      applyEventManagerQueryAccess(query, 'viewer', 'manage_participants')
    );
    expectQueryMutation(query => applyBlogManagerQueryAccess(query, undefined));
    expectQueryMutation(query => applyBlogManagerQueryAccess(query, 'viewer'));
    expectQueryMutation(query => applyGroupDiscoveryQueryAccess(query, undefined));
    expectQueryMutation(query => applyGroupDiscoveryQueryAccess(query, 'viewer'));
  });

  it('builds document access for anonymous/authenticated viewers and flip profiles', () => {
    expectQueryMutation(query => applyDocumentQueryAccess(query, undefined));
    expectQueryMutation(query =>
      applyDocumentQueryAccess(query, undefined, { amendmentFlip: false })
    );
    expectQueryMutation(query => applyDocumentQueryAccess(query, 'viewer'));
    expectQueryMutation(query =>
      applyDocumentQueryAccess(query, 'viewer', {
        amendmentFlip: true,
        collaboratorFlip: false,
      })
    );
  });
});

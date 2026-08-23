import { describe, expect, it } from 'vitest';

import {
  applyChangeRequestVisibilityAccess,
  applyAmendmentQueryAccess,
  applyBlogQueryAccess,
  applyDocumentQueryAccess,
  applyGroupDiscoveryQueryAccess,
  applyElectionQueryAccess,
  applyGroupQueryAccess,
  applyEventQueryAccess,
  applySearchDocumentQueryAccess,
  applyTodoQueryAccess,
  applyVoteQueryAccess,
} from '../query-access';

type Call = readonly [string, ...unknown[]];

interface FakeQuery {
  calls: Call[];
  where: (...args: unknown[]) => FakeQuery;
  whereExists: (relation: string, fn: (query: FakeQuery) => unknown) => FakeQuery;
}

function createQuery(calls: Call[] = []): FakeQuery {
  const query: FakeQuery = {
    calls,
    where: (...args: unknown[]) => {
      calls.push(['where', ...args]);
      if (typeof args[0] === 'function') {
        args[0]({
          cmp: (...values: unknown[]) => ['cmp', ...values],
          exists: (relation: string, fn: (child: FakeQuery) => unknown) => {
            const childCalls: Call[] = [];
            calls.push(['exists', relation, childCalls]);
            fn(createQuery(childCalls));
            return ['exists', relation];
          },
          or: (...values: unknown[]) => ['or', ...values],
        });
      }
      return query;
    },
    whereExists: (relation, fn) => {
      const childCalls: Call[] = [];
      calls.push(['whereExists', relation, childCalls]);
      fn(createQuery(childCalls));
      return query;
    },
  };

  return query;
}

describe('public content query access', () => {
  it('allows anonymous document reads only through a public amendment', () => {
    const query = createQuery();

    applyDocumentQueryAccess(query, undefined);

    expect(query.calls).toEqual([
      [
        'whereExists',
        'amendment',
        [
          ['where', 'tutorial_run_id', 'IS', null],
          ['where', 'visibility', 'public'],
        ],
      ],
    ]);
  });

  it('keeps anonymous change requests limited to public visibility scopes', () => {
    const query = createQuery();

    applyChangeRequestVisibilityAccess(query, undefined);

    const predicate = query.calls[0]?.[1];
    expect(typeof predicate).toBe('function');

    const comparisons: unknown[][] = [];
    (predicate as (helpers: Record<string, (...args: unknown[]) => unknown>) => unknown)({
      cmp: (...args: unknown[]) => {
        comparisons.push(args);
        return args;
      },
      exists: () => null,
      or: (...args: unknown[]) => args,
    });

    expect(comparisons).toEqual([
      ['visibility_scope', 'IS', null],
      ['visibility_scope', 'public'],
      ['visibility_scope', '__public_only__'],
    ]);
  });

  it('limits anonymous search documents to public visibility', () => {
    const query = createQuery();

    applySearchDocumentQueryAccess(query, undefined);

    expect(query.calls).toEqual([
      ['where', 'tutorial_run_id', 'IS', null],
      ['where', 'visibility', 'public'],
    ]);
  });

  it('uses the materialized ACL for private authenticated search results', () => {
    const query = createQuery();

    applySearchDocumentQueryAccess(query, 'user-1');

    expect(query.calls).toEqual([
      ['where', expect.any(Function)],
      [
        'exists',
        'tutorial_run',
        [
          ['where', 'user_id', 'user-1'],
          ['where', 'status', 'IN', ['active', 'paused']],
        ],
      ],
      ['where', expect.any(Function)],
      ['exists', 'acl', [['where', 'user_id', 'user-1']]],
    ]);
  });

  it('only treats active memberships and guest access as private group relationships', () => {
    const query = createQuery();

    applyGroupQueryAccess(query, 'user-1');

    expect(query.calls).toContainEqual([
      'exists',
      'memberships',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active', 'member', 'admin']],
      ],
    ]);
    expect(query.calls).toContainEqual([
      'exists',
      'guest_accesses',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active']],
      ],
    ]);
  });

  it('requires a groups:view or groups:manage role for private group discovery, including invitations', () => {
    const query = createQuery();

    applyGroupDiscoveryQueryAccess(query, 'user-1');

    const memberships = query.calls.find(
      call => call[0] === 'exists' && call[1] === 'memberships'
    )?.[2] as Call[];
    expect(memberships).toContainEqual([
      'where',
      'status',
      'IN',
      ['invited', 'active', 'member', 'admin'],
    ]);

    const membershipRoles = memberships.find(
      call => call[0] === 'whereExists' && call[1] === 'membership_roles'
    )?.[2] as Call[];
    const roles = membershipRoles.find(
      call => call[0] === 'whereExists' && call[1] === 'role'
    )?.[2] as Call[];
    const rights = roles.find(
      call => call[0] === 'whereExists' && call[1] === 'action_rights'
    )?.[2] as Call[];

    expect(rights).toContainEqual(['where', 'resource', 'IN', ['groups']]);
    expect(rights).toContainEqual(['where', 'action', 'IN', ['view', 'manage']]);
    expect(query.calls).toContainEqual([
      'exists',
      'guest_accesses',
      expect.arrayContaining([['where', 'status', 'IN', ['invited', 'active']]]),
    ]);

    const discoveryPredicate = query.calls.filter(call => call[0] === 'where').at(-1)?.[1];
    const comparisons: unknown[][] = [];
    (discoveryPredicate as (helpers: Record<string, (...args: unknown[]) => unknown>) => unknown)({
      cmp: (...args: unknown[]) => {
        comparisons.push(args);
        return args;
      },
      exists: () => null,
      or: (...args: unknown[]) => args,
    });
    expect(comparisons).toContainEqual(['visibility', 'IN', ['public', 'authenticated']]);
  });

  it('carries active event and amendment relationships into private task access', () => {
    const query = createQuery();

    applyTodoQueryAccess(query, 'user-1');

    const eventCall = query.calls.find(call => call[0] === 'exists' && call[1] === 'event');
    const amendmentCall = query.calls.find(call => call[0] === 'exists' && call[1] === 'amendment');
    const eventCalls = eventCall?.[2] as Call[];
    const amendmentCalls = amendmentCall?.[2] as Call[];

    expect(eventCalls).toContainEqual([
      'exists',
      'participants',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active', 'confirmed', 'member', 'admin']],
      ],
    ]);
    expect(eventCalls.some(call => call[0] === 'exists' && call[1] === 'group')).toBe(true);
    expect(amendmentCalls).toContainEqual([
      'exists',
      'collaborators',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active', 'collaborator', 'member', 'admin']],
      ],
    ]);
    expect(amendmentCalls.some(call => call[0] === 'exists' && call[1] === 'group')).toBe(true);
    expect(amendmentCalls.some(call => call[0] === 'exists' && call[1] === 'event')).toBe(true);
  });

  it.each([
    {
      name: 'event',
      apply: applyEventQueryAccess,
      roleRelation: 'roles',
      scope: 'event',
      holderRelation: 'event_participant_roles',
      relationshipRelation: 'event_participant',
      statuses: ['invited', 'active', 'confirmed', 'member', 'admin'],
      rightRelation: 'event_action_rights',
      resource: 'events',
    },
    {
      name: 'amendment',
      apply: applyAmendmentQueryAccess,
      roleRelation: 'roles',
      scope: 'amendment',
      holderRelation: 'amendment_collaborators',
      relationshipRelation: null,
      statuses: ['invited', 'active', 'collaborator', 'member', 'admin'],
      rightRelation: 'amendment_action_rights',
      resource: 'amendments',
    },
    {
      name: 'blog',
      apply: applyBlogQueryAccess,
      roleRelation: 'roles',
      scope: 'blog',
      holderRelation: 'bloggers',
      relationshipRelation: null,
      statuses: ['invited', 'admin', 'member', 'writer'],
      rightRelation: 'blog_action_rights',
      resource: 'blogs',
    },
  ])('requires scoped, view-implying roles for $name discovery', scenario => {
    const query = createQuery();
    scenario.apply(query, 'user-1');

    const roleCalls = query.calls.find(
      call => call[0] === 'exists' && call[1] === scenario.roleRelation
    )?.[2] as Call[];
    expect(roleCalls).toContainEqual(['where', 'scope', scenario.scope]);

    const holderCalls = roleCalls.find(
      call => call[0] === 'whereExists' && call[1] === scenario.holderRelation
    )?.[2] as Call[];
    const relationshipCalls = scenario.relationshipRelation
      ? (holderCalls.find(
          call => call[0] === 'whereExists' && call[1] === scenario.relationshipRelation
        )?.[2] as Call[])
      : holderCalls;
    expect(relationshipCalls).toContainEqual(['where', 'user_id', 'user-1']);
    expect(relationshipCalls).toContainEqual(['where', 'status', 'IN', scenario.statuses]);

    const rightCalls = roleCalls.find(
      call => call[0] === 'whereExists' && call[1] === scenario.rightRelation
    )?.[2] as Call[];
    expect(rightCalls).toContainEqual(['where', 'resource', scenario.resource]);
    expect(rightCalls).toContainEqual([
      'where',
      'action',
      'IN',
      [
        'view',
        'manage',
        'moderate',
        'manage_members',
        'manage_roles',
        'manage_participants',
        'manage_speakers',
        'manage_votes',
        'speak',
      ],
    ]);
  });

  it('scopes elections through an accessible agenda item or role root', () => {
    const query = createQuery();

    applyElectionQueryAccess(query, 'user-1');

    const agendaCall = query.calls.find(call => call[0] === 'exists' && call[1] === 'agenda_item');
    const roleCall = query.calls.find(call => call[0] === 'exists' && call[1] === 'role');
    const agendaCalls = agendaCall?.[2] as Call[];
    const roleCalls = roleCall?.[2] as Call[];
    const eventCall = agendaCalls.find(call => call[0] === 'exists' && call[1] === 'event');
    const eventCalls = eventCall?.[2] as Call[];

    expect(eventCalls).toContainEqual([
      'exists',
      'tutorial_run',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active', 'paused']],
      ],
    ]);
    expect(roleCalls.some(call => call[0] === 'exists' && call[1] === 'group')).toBe(true);
  });

  it('scopes votes through an accessible agenda item or amendment root', () => {
    const query = createQuery();

    applyVoteQueryAccess(query, 'user-1');

    const scopeCalls = query.calls.slice(0, 3);
    expect(scopeCalls[0]).toEqual(['where', expect.any(Function)]);
    expect(scopeCalls.some(call => call[0] === 'exists' && call[1] === 'agenda_item')).toBe(true);
    expect(scopeCalls.some(call => call[0] === 'exists' && call[1] === 'amendment')).toBe(true);

    const amendmentCall = scopeCalls.find(call => call[0] === 'exists' && call[1] === 'amendment');
    const amendmentCalls = amendmentCall?.[2] as Call[];
    expect(amendmentCalls).toContainEqual([
      'exists',
      'tutorial_run',
      [
        ['where', 'user_id', 'user-1'],
        ['where', 'status', 'IN', ['active', 'paused']],
      ],
    ]);
  });
});

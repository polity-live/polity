import { describe, expect, it, vi } from 'vitest';
import type { ResultRow } from './query-result-harness';

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_validator: unknown, fn: unknown) => ({ fn }),
}));
vi.mock('../../schema', async () => {
  const { resultQuery } = await import('./query-result-harness');
  return { zql: new Proxy({}, { get: () => resultQuery() }) };
});

// Access helpers are deliberately real: these assertions exercise their result
// predicates, including related rows, rather than the planner options.
import { commonQueries } from '../queries';
import { electionQueries } from '../../elections/queries';
import { voteQueries } from '../../votes/queries';
import { agendaQueries } from '../../agendas/queries';
import { eventQueries } from '../../events/queries';

const ctx = { userID: 'viewer', email: 'viewer@example.test' };
const anonymous = { userID: 'anon', email: '' };
const publicEntity = (id: string, extra: ResultRow = {}): ResultRow => ({
  id,
  visibility: 'public',
  tutorial_run_id: null,
  ...extra,
});
const ids = (result: ResultRow[]) => result.map(row => row.id);
const run = (definition: any, args: ResultRow, source: ResultRow[], viewer = ctx): any =>
  definition.fn({ args, ctx: viewer }).run(source);

describe('correlated common query result authorization', () => {
  it('keeps every subscriber target alternative and newest-first ordering', () => {
    const source: ResultRow[] = ['user', 'group', 'amendment', 'event', 'blog'].map(
      (relation, index) => ({
        id: relation,
        subscriber_id: 'other',
        created_at: index,
        [relation]: publicEntity(`${relation}-target`),
      })
    );
    source.push({
      id: 'own-private',
      subscriber_id: 'viewer',
      created_at: 10,
      blog: publicEntity('private', { visibility: 'private' }),
    });
    source.push({
      id: 'other-private',
      subscriber_id: 'other',
      created_at: 11,
      blog: publicEntity('hidden', { visibility: 'private' }),
    });

    expect(ids(run(commonQueries.subscribers, {}, source))).toEqual([
      'own-private',
      'blog',
      'event',
      'amendment',
      'group',
      'user',
    ]);
    expect(ids(run(commonQueries.subscribers, {}, source, anonymous))).toEqual([
      'blog',
      'event',
      'amendment',
      'group',
      'user',
    ]);
  });

  it('enforces active private group access and tutorial ownership for links', () => {
    const membership = { id: 'membership', user_id: 'viewer', status: 'active' };
    const active = publicEntity('active', { visibility: 'private', memberships: [membership] });
    const invited = publicEntity('invited', {
      visibility: 'private',
      memberships: [{ ...membership, status: 'invited' }],
    });
    const ownedRun = { id: 'run', user_id: 'viewer', status: 'active' };
    const source = [
      { id: 'public', created_at: 1, group: publicEntity('public') },
      { id: 'active', created_at: 2, group: active },
      { id: 'invited', created_at: 3, group: invited },
      {
        id: 'tutorial',
        created_at: 4,
        group: publicEntity('tutorial', { tutorial_run_id: 'run', tutorial_run: ownedRun }),
      },
      {
        id: 'foreign-tutorial',
        created_at: 5,
        group: publicEntity('foreign', {
          tutorial_run_id: 'foreign-run',
          tutorial_run: { ...ownedRun, user_id: 'other' },
        }),
      },
    ];

    expect(ids(run(commonQueries.links, {}, source))).toEqual(['tutorial', 'active', 'public']);
    expect(ids(run(commonQueries.links, {}, source, anonymous))).toEqual(['public']);
    membership.status = 'revoked';
    ownedRun.status = 'completed';
    expect(ids(run(commonQueries.links, {}, source))).toEqual(['public']);
  });

  it('removes blog subscriptions from entity lists when the view right is revoked', () => {
    const rights = [{ id: 'right', resource: 'blogs', action: 'view' }];
    const role = {
      id: 'role',
      scope: 'blog',
      bloggers: [{ id: 'writer', user_id: 'viewer', status: 'writer' }],
      blog_action_rights: rights,
    };
    const source = [
      {
        id: 'subscription',
        subscriber_id: 'other',
        created_at: 1,
        blog_id: 'blog',
        blog: publicEntity('blog', { visibility: 'private', roles: [role] }),
      },
    ];
    expect(ids(run(commonQueries.subscribers, { blog_id: 'blog' }, source))).toEqual([
      'subscription',
    ]);
    rights.length = 0;
    expect(run(commonQueries.subscribers, { blog_id: 'blog' }, source)).toEqual([]);
  });

  it('preserves viewer scope and related subscription denials', () => {
    const blog = publicEntity('blog', {
      visibility: 'private',
      bloggers: [{ id: 'owner', user_id: 'viewer', status: 'owner' }],
    });
    const source = [
      { id: 'own', subscriber_id: 'viewer', blog },
      { id: 'other', subscriber_id: 'other', blog },
    ];
    const own = run(commonQueries.userSubscriptions, { subscriber_id: 'viewer' }, source);
    expect(ids(own)).toEqual(['own']);
    expect(own[0].blog.id).toBe('blog');
    expect(run(commonQueries.userSubscriptions, { subscriber_id: 'other' }, source)).toEqual([]);
    expect(
      run(commonQueries.userSubscriptions, { subscriber_id: 'viewer' }, source, anonymous)
    ).toEqual([]);
    blog.bloggers[0].status = 'revoked';
    const after = run(commonQueries.userSubscriptions, { subscriber_id: 'viewer' }, source);
    expect(ids(after)).toEqual(['own']);
    expect(after[0].blog).toBeUndefined();
  });
});

function decisionFixture(kind: 'election' | 'vote') {
  const event = publicEntity('event', { creator_id: 'other', participants: [] });
  const item = { id: 'agenda', event_id: 'event', creator_id: 'other', event };
  const voterRelation = kind === 'election' ? 'electors' : 'voters';
  const identityField = kind === 'election' ? 'elector_id' : 'voter_id';
  const parentField = `${kind}_id`;
  const identity: ResultRow = { id: 'identity', user_id: 'viewer', [parentField]: 'decision' };
  const parent: ResultRow = {
    id: 'decision',
    visibility: 'private',
    agenda_item_id: 'agenda',
    agenda_item: item,
    [voterRelation]: [identity],
  };
  const selectionRelation = kind === 'election' ? 'selections' : 'decisions';
  const leafRelation = kind === 'election' ? 'candidate' : 'choice';
  const participation: ResultRow = {
    id: 'participation',
    [parentField]: 'decision',
    [identityField]: 'identity',
    user_id: 'viewer',
    [kind]: parent,
    [kind === 'election' ? 'elector' : 'voter']: identity,
    [selectionRelation]: [{ id: 'selection', [leafRelation]: { id: 'option' } }],
  };
  return {
    parent,
    participation,
    identity,
    parentField,
    identityField,
    selectionRelation,
    leafRelation,
  };
}

describe.each(['election', 'vote'] as const)('correlated %s participation results', kind => {
  const queries = kind === 'election' ? electionQueries : voteQueries;

  it('preserves own participation and selections while denying a spoofed final identity', () => {
    const fixture = decisionFixture(kind);
    const args = { [fixture.parentField]: 'decision', [fixture.identityField]: 'identity' };
    const indicative = run(queries.userIndicativeParticipation, args, [fixture.participation]);
    const final = run(queries.userFinalParticipation, args, [fixture.participation]);
    expect(indicative.id).toBe('participation');
    expect(final[fixture.selectionRelation][0][fixture.leafRelation].id).toBe('option');
    expect(
      run(queries.userFinalParticipation, args, [fixture.participation], {
        ...ctx,
        userID: 'other',
      })
    ).toBeUndefined();
    expect(
      run(queries.userIndicativeParticipation, args, [fixture.participation], anonymous)
    ).toBeUndefined();
  });

  it('denies an existing participation after its parent access is revoked', () => {
    const fixture = decisionFixture(kind);
    const args = { [fixture.parentField]: 'decision', [fixture.identityField]: 'identity' };
    expect(run(queries.userFinalParticipation, args, [fixture.participation]).id).toBe(
      'participation'
    );
    fixture.parent[kind === 'election' ? 'electors' : 'voters'].length = 0;
    expect(run(queries.userIndicativeParticipation, args, [fixture.participation])).toBeUndefined();
    expect(run(queries.userFinalParticipation, args, [fixture.participation])).toBeUndefined();
  });
});

describe('authorized agenda projections', () => {
  it('keeps private decisions for their elector/voter and hides them after revocation', () => {
    const election = decisionFixture('election');
    const vote = decisionFixture('vote');
    const item = {
      id: 'agenda',
      event_id: 'event',
      event: publicEntity('event'),
      creator_id: 'other',
      election: [election.parent],
      votes: [vote.parent],
      amendment: null,
    };
    const args = { event_ids: ['event'] };
    const result = run(agendaQueries.byEventIds, args, [item]);
    expect(ids(result)).toEqual(['agenda']);
    expect(ids(result[0].election)).toEqual(['decision']);
    expect(ids(result[0].votes)).toEqual(['decision']);
    const denied = run(agendaQueries.byEventIds, args, [item], anonymous);
    expect(denied[0].election).toEqual([]);
    expect(denied[0].votes).toEqual([]);
    election.parent.electors.length = 0;
    vote.parent.voters.length = 0;
    const revoked = run(agendaQueries.byEventIds, args, [item]);
    expect(revoked[0].election).toEqual([]);
    expect(revoked[0].votes).toEqual([]);
    item.event.visibility = 'private';
    expect(run(agendaQueries.byEventIds, args, [item])).toEqual([]);
  });

  it('inherits byIdFull agenda access from the event while preserving decision visibility', () => {
    const participant = { id: 'participant', user_id: 'viewer', status: 'active' };
    const event = publicEntity('event', {
      visibility: 'private',
      creator_id: 'other',
      participants: [participant],
      roles: [
        {
          id: 'view-role',
          scope: 'event',
          event_participant_roles: [{ id: 'assignment', event_participant: participant }],
          event_action_rights: [{ id: 'view-right', resource: 'events', action: 'view' }],
        },
      ],
    });
    const item: ResultRow = {
      id: 'agenda',
      event_id: event.id,
      creator_id: 'other',
      event,
    };
    const privateElection = {
      id: 'private-election',
      agenda_item_id: item.id,
      agenda_item: item,
      visibility: 'private',
      electors: [],
    };
    const privateVote = {
      id: 'private-vote',
      agenda_item_id: item.id,
      agenda_item: item,
      visibility: 'private',
      voters: [],
    };
    item.election = [
      privateElection,
      { ...privateElection, id: 'public-election', visibility: 'public' },
    ];
    item.votes = [privateVote, { ...privateVote, id: 'public-vote', visibility: 'public' }];
    event.agenda_items = [item];
    const args = { id: event.id };
    const source = [event];

    // The event's view right authorizes its agenda. Active participation also
    // grants the independent private election/vote visibility predicate.
    const authorized = run(eventQueries.byIdFull, args, source);
    expect(ids(authorized[0].agenda_items)).toEqual(['agenda']);
    expect(ids(authorized[0].agenda_items[0].election)).toEqual([
      'private-election',
      'public-election',
    ]);
    expect(ids(authorized[0].agenda_items[0].votes)).toEqual(['private-vote', 'public-vote']);
    expect(run(eventQueries.byIdFull, args, source, anonymous)).toEqual([]);

    participant.status = 'revoked';
    expect(run(eventQueries.byIdFull, args, source)).toEqual([]);

    // Public event visibility restores only the agenda and public decisions;
    // it does not restore the revoked private decision access.
    event.visibility = 'public';
    for (const viewer of [ctx, anonymous]) {
      const visible = run(eventQueries.byIdFull, args, source, viewer);
      expect(ids(visible[0].agenda_items)).toEqual(['agenda']);
      expect(ids(visible[0].agenda_items[0].election)).toEqual(['public-election']);
      expect(ids(visible[0].agenda_items[0].votes)).toEqual(['public-vote']);
    }
    event.visibility = 'authenticated';
    expect(ids(run(eventQueries.byIdFull, args, source))).toEqual(['event']);
    expect(run(eventQueries.byIdFull, args, source, anonymous)).toEqual([]);
  });

  it('keeps stream manager-only results hidden from ordinary event participants', () => {
    const event = publicEntity('event', {
      creator_id: 'manager',
      participants: [{ id: 'participant', user_id: 'viewer', status: 'active' }],
    });
    const item: ResultRow = {
      id: 'agenda',
      creator_id: 'other',
      event,
      election: [],
      votes: [],
      speaker_list: [],
    };
    const election = decisionFixture('election');
    election.parent.agenda_item = item;
    election.parent.offline_tallies = [
      { id: 'tally', election: election.parent, candidate: { id: 'candidate' } },
    ];
    election.parent.indicative_selections = [];
    election.parent.final_selections = [];
    item.election.push(election.parent);
    const source = [{ ...event, agenda_items: [item], offline_participants: [] }];
    const participant = run(eventQueries.streamEvent, { id: 'event' }, source);
    expect(ids(participant[0].agenda_items[0].election)).toEqual(['decision']);
    expect(participant[0].agenda_items[0].election[0].offline_tallies).toEqual([]);
    const manager = run(eventQueries.streamEvent, { id: 'event' }, source, {
      ...ctx,
      userID: 'manager',
    });
    expect(ids(manager[0].agenda_items[0].election[0].offline_tallies)).toEqual(['tally']);
    expect(
      run(eventQueries.streamEvent, { id: 'event' }, source, anonymous)[0].agenda_items[0].election
    ).toEqual([]);
  });
});

describe.each(['election', 'vote'] as const)('%s decision page authorization', kind => {
  const queries = kind === 'election' ? electionQueries : voteQueries;
  const args = { statuses: [], groupIds: [], query: '', limit: 20, start: null, dir: 'forward' };

  it('keeps manager results only while the event role right and participant are active', () => {
    const fixture = decisionFixture(kind);
    const participant = { id: 'participant', user_id: 'viewer', status: 'active' };
    const rights = [{ id: 'right', resource: 'events', action: 'manage_votes' }];
    fixture.parent.visibility = 'public';
    fixture.parent.created_at = 1;
    fixture.parent.agenda_item.event.roles = [
      {
        id: 'manager-role',
        scope: 'event',
        event_action_rights: rights,
        event_participant_roles: [{ id: 'assignment', event_participant: participant }],
      },
    ];
    const identityRelation = kind === 'election' ? 'electors' : 'voters';
    const resultRelations =
      kind === 'election'
        ? ['offline_tallies', 'indicative_selections', 'final_selections']
        : ['offline_tallies', 'indicative_decisions', 'final_decisions'];
    fixture.identity[kind] = fixture.parent;
    fixture.parent[identityRelation].push({
      id: 'other',
      user_id: 'other',
      [kind]: fixture.parent,
    });
    for (const relation of resultRelations) {
      fixture.parent[relation] = [
        { id: relation, [kind]: fixture.parent, [fixture.leafRelation]: { id: 'option' } },
      ];
    }
    const source = [fixture.parent];
    const assertManager = () => {
      const row = run(queries.decisionPage, args, source)[0];
      expect(ids(row[identityRelation])).toEqual(['identity', 'other']);
      for (const relation of resultRelations) expect(ids(row[relation])).toEqual([relation]);
    };
    const assertDenied = (viewer = ctx) => {
      const row = run(queries.decisionPage, args, source, viewer)[0];
      expect(row.id).toBe('decision');
      expect(ids(row[identityRelation])).toEqual(viewer === anonymous ? [] : ['identity']);
      for (const relation of resultRelations) expect(row[relation]).toEqual([]);
    };
    assertManager();
    assertDenied(anonymous);
    rights.length = 0;
    assertDenied();
    rights.push({ id: 'right', resource: 'events', action: 'manage_votes' });
    assertManager();
    participant.status = 'revoked';
    assertDenied();
  });

  it('intersects group filters with visibility and preserves ties and exclusive cursors', () => {
    const make = (id: string, group: string, visibility = 'public') => ({
      id,
      created_at: 10,
      visibility,
      title: 'Decision',
      status: 'pending',
      agenda_item: { id: `agenda-${id}`, event: publicEntity(`event-${id}`, { group_id: group }) },
    });
    const source = [
      make('a', 'selected'),
      make('b', 'selected'),
      make('c', 'other'),
      make('d', 'selected', 'authenticated'),
      make('e', 'selected', 'private'),
    ];
    const filtered = { ...args, groupIds: ['selected'], statuses: ['pending'], query: 'Decision' };
    expect(ids(run(queries.decisionPage, filtered, source, anonymous))).toEqual(['b', 'a']);
    expect(ids(run(queries.decisionPage, filtered, source))).toEqual(['d', 'b', 'a']);
    expect(ids(run(queries.decisionPage, { ...filtered, groupIds: ['missing'] }, source))).toEqual(
      []
    );
    expect(ids(run(queries.decisionPage, { ...filtered, limit: 1 }, source, anonymous))).toEqual([
      'b',
    ]);
    expect(
      ids(
        run(
          queries.decisionPage,
          { ...filtered, start: { id: 'b', created_at: 10 } },
          source,
          anonymous
        )
      )
    ).toEqual(['a']);
    expect(
      ids(
        run(
          queries.decisionPage,
          { ...filtered, dir: 'backward', start: { id: 'a', created_at: 10 } },
          source,
          anonymous
        )
      )
    ).toEqual(['b']);
  });
});

describe('correlated election roots and cursor results', () => {
  it('requires public election and public role scope for anonymous decision pages', () => {
    const source: ResultRow[] = [
      {
        id: 'visible',
        created_at: 1,
        visibility: 'public',
        role: {
          id: 'role',
          visibility: 'public',
          group: publicEntity('group'),
        },
      },
      {
        id: 'private-election',
        created_at: 2,
        visibility: 'private',
        role: {
          id: 'role-private-election',
          visibility: 'public',
          group: publicEntity('group'),
        },
      },
      {
        id: 'private-scope',
        created_at: 3,
        visibility: 'public',
        role: {
          id: 'role-private-scope',
          visibility: 'public',
          group: publicEntity('hidden', { visibility: 'private' }),
        },
      },
      {
        id: 'tutorial-scope',
        created_at: 4,
        visibility: 'public',
        role: {
          id: 'role-tutorial',
          visibility: 'public',
          group: publicEntity('tutorial', { tutorial_run_id: 'run' }),
        },
      },
    ];
    const args = { statuses: [], groupIds: [], query: '', limit: 20, start: null, dir: 'forward' };
    expect(ids(run(electionQueries.decisionPage, args, source, anonymous))).toEqual(['visible']);
    source[0].role.group.visibility = 'private';
    expect(run(electionQueries.decisionPage, args, source, anonymous)).toEqual([]);
  });

  it('keeps public role elections while withdrawing a revoked role projection', () => {
    const holder = { id: 'holder', user_id: 'viewer', end_date: null as number | null };
    const role = {
      id: 'role',
      visibility: 'private',
      group: publicEntity('group'),
      holders: [holder],
    };
    const source = [
      {
        id: 'election',
        agenda_item_id: 'agenda',
        visibility: 'public',
        role,
        candidates: [],
        offline_tallies: [],
        electors: [],
        indicative_participations: [],
        indicative_selections: [],
        final_participations: [],
        final_selections: [],
      },
    ];
    const before = run(electionQueries.byId, { id: 'election' }, source);
    expect(before.id).toBe('election');
    expect(before.role.id).toBe('role');
    expect(run(electionQueries.byAgendaItem, { agenda_item_id: 'agenda' }, source)[0].role.id).toBe(
      'role'
    );
    holder.end_date = 100;
    const after = run(electionQueries.byId, { id: 'election' }, source);
    expect(after.id).toBe('election');
    expect(after.role).toBeUndefined();
    expect(run(electionQueries.byId, { id: 'election' }, source, anonymous).role).toBeUndefined();
    role.group.visibility = 'private';
    expect(run(electionQueries.byId, { id: 'election' }, source)).toBeUndefined();
  });

  it('preserves status, search, stable ties and exclusive page cursors', () => {
    const source = [
      {
        id: 'a',
        created_at: 10,
        title: 'Decision A',
        status: 'pending',
        visibility: 'public',
        agenda_item: { id: 'agenda-a', event: publicEntity('event-a') },
      },
      {
        id: 'b',
        created_at: 10,
        title: 'Decision B',
        status: 'pending',
        visibility: 'public',
        agenda_item: { id: 'agenda-b', event: publicEntity('event-b') },
      },
      {
        id: 'c',
        created_at: 20,
        title: 'Decision C',
        status: 'closed',
        visibility: 'public',
        agenda_item: { id: 'agenda-c', event: publicEntity('event-c') },
      },
    ];
    const args = {
      status: 'pending',
      statuses: [],
      groupIds: [],
      query: 'Decision',
      limit: 10,
      start: null,
      dir: 'forward',
    };
    expect(ids(run(electionQueries.decisionPage, args, source, anonymous))).toEqual(['b', 'a']);
    expect(
      ids(
        run(
          electionQueries.decisionPage,
          { ...args, start: { id: 'b', created_at: 10 } },
          source,
          anonymous
        )
      )
    ).toEqual(['a']);
    expect(
      ids(
        run(
          electionQueries.decisionPage,
          { ...args, start: { id: 'a', created_at: 10 }, dir: 'backward' },
          source,
          anonymous
        )
      )
    ).toEqual(['b']);
  });
});

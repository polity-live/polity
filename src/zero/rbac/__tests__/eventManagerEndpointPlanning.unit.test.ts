import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { queryAST } from '../../../../tools/e2e/zero-performance/oracle';
import {
  applyAmendmentQueryAccess,
  applyElectionElectorOrManagerQueryAccess,
  applyElectionManagerQueryAccess,
  applyEventManagerQueryAccess,
  applyVoteManagerQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
} from '../query-access';
import { whereAnyOf } from '../../shared/query-conditions';
import { zql } from '../../schema';

const actions = ['manage', 'manage_participants', 'manage_speakers', 'manage_votes'] as const;
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== 'flip')
            .map(([key, child]) => [key, canonical(child)])
        )
      : value;

function originalBallotEventManager(q: any, userID: string, resources: string[]) {
  return q.where(({ or, cmp, exists }: any) =>
    or(
      cmp('creator_id', userID),
      exists(
        'roles',
        (role: any) =>
          role
            .where('scope', 'event')
            .whereExists(
              'event_participant_roles',
              (link: any) =>
                link.whereExists(
                  'event_participant',
                  (participant: any) =>
                    whereAnyOf(participant.where('user_id', userID), 'status', [
                      'active',
                      'confirmed',
                      'member',
                      'admin',
                    ]),
                  { flip: false }
                ),
              { flip: false }
            )
            .whereExists(
              'event_action_rights',
              (right: any) =>
                whereAnyOf(whereAnyOf(right, 'resource', resources), 'action', [
                  'manage',
                  'manage_votes',
                ]),
              { flip: false }
            ),
        { flip: false }
      )
    )
  );
}

function originalElectionManager(q: any, userID: string) {
  return q.whereExists(
    'agenda_item',
    (item: any) =>
      item.whereExists(
        'event',
        (event: any) => originalBallotEventManager(event, userID, ['events', 'elections']),
        { flip: false }
      ),
    { flip: false }
  );
}

function originalVoteManager(q: any, userID: string) {
  return q.where(({ or, exists }: any) =>
    or(
      exists(
        'agenda_item',
        (item: any) =>
          item.whereExists(
            'event',
            (event: any) => originalBallotEventManager(event, userID, ['events']),
            { flip: false }
          ),
        { flip: false }
      ),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID), {
        flip: false,
      })
    )
  );
}

const ballotCases = [
  {
    name: 'election manager',
    actual: (userID: string) => applyElectionManagerQueryAccess(zql.election, userID),
    original: (userID: string) => originalElectionManager(zql.election, userID),
    endpointCount: 3,
  },
  {
    name: 'election elector or manager',
    actual: (userID: string) => applyElectionElectorOrManagerQueryAccess(zql.elector, userID),
    original: (userID: string) =>
      zql.elector.where(({ or, cmp, exists }) =>
        or(
          cmp('user_id', userID),
          exists('election', q => originalElectionManager(q, userID), { flip: false })
        )
      ),
    endpointCount: 4,
  },
  {
    name: 'vote manager',
    actual: (userID: string) => applyVoteManagerQueryAccess(zql.vote, userID),
    original: (userID: string) => originalVoteManager(zql.vote, userID),
    endpointCount: 3,
  },
  {
    name: 'vote voter or manager',
    actual: (userID: string) => applyVoteVoterOrManagerQueryAccess(zql.voter, userID),
    original: (userID: string) =>
      zql.voter.where(({ or, cmp, exists }) =>
        or(
          cmp('user_id', userID),
          exists('vote', q => originalVoteManager(q, userID), { flip: false })
        )
      ),
    endpointCount: 4,
  },
];

describe('ballot manager indexed foreign-key endpoints', () => {
  it.each(ballotCases)('preserves every original access predicate for $name', entry => {
    for (const userID of ['owner', 'outsider']) {
      const actual = queryAST(entry.actual(userID));
      expect(canonical(actual)).toEqual(canonical(queryAST(entry.original(userID))));
      const endpoints: any[] = [];
      const visit = (value: any) => {
        if (value?.type === 'correlatedSubquery' && value.flip === true) endpoints.push(value);
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') Object.values(value).forEach(visit);
      };
      visit(actual);
      expect(endpoints).toHaveLength(entry.endpointCount);
      for (const endpoint of endpoints) {
        expect(endpoint.op).toBe('EXISTS');
        expect(endpoint.related.correlation.childField).toEqual(['id']);
        expect(endpoint.related.correlation.parentField).toEqual([
          `${endpoint.related.subquery.table}_id`,
        ]);
      }
    }
  });

  it('targets indexed primary keys for every added endpoint', () => {
    const migration = readFileSync('supabase/migrations/20260922043912_initial_reset.sql', 'utf8');
    for (const child of ['agenda_item', 'event', 'election', 'vote']) {
      expect(migration).toContain(
        `alter table "public"."${child}" add constraint "${child}_pkey" PRIMARY KEY using index "${child}_pkey";`
      );
    }
  });
});

describe('event manager indexed participant endpoint', () => {
  it.each(actions)('preserves creator, active role and right predicates for %s', action => {
    for (const userID of ['owner', 'outsider']) {
      const rights = action === 'manage' ? ['manage'] : ['manage', action];
      const original = zql.event.where(({ or, cmp, exists }) =>
        or(
          cmp('creator_id', userID),
          exists(
            'roles',
            role =>
              role
                .where('scope', 'event')
                .whereExists(
                  'event_participant_roles',
                  link =>
                    link.whereExists(
                      'event_participant',
                      participant =>
                        whereAnyOf(participant.where('user_id', userID), 'status', [
                          'active',
                          'confirmed',
                          'member',
                          'admin',
                        ]),
                      { flip: false }
                    ),
                  { flip: false }
                )
                .whereExists(
                  'event_action_rights',
                  right => whereAnyOf(whereAnyOf(right, 'resource', ['events']), 'action', rights),
                  { flip: false }
                ),
            { flip: false }
          )
        )
      );
      const actual = queryAST(applyEventManagerQueryAccess(zql.event, userID, action));
      expect(canonical(actual)).toEqual(canonical(queryAST(original)));
      const endpoints: any[] = [];
      const visit = (value: any) => {
        if (value?.type === 'correlatedSubquery' && value.flip === true) endpoints.push(value);
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') Object.values(value).forEach(visit);
      };
      visit(actual);
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0]).toMatchObject({
        op: 'EXISTS',
        related: {
          subquery: { table: 'event_participant' },
          correlation: { parentField: ['event_participant_id'], childField: ['id'] },
        },
      });
    }
  });
  it('requires the validated participant foreign key for the indexed endpoint', () => {
    const migration = readFileSync('supabase/migrations/20260922043912_initial_reset.sql', 'utf8');
    expect(migration).toContain(
      'FOREIGN KEY (event_participant_id) REFERENCES public.event_participant(id)'
    );
    expect(migration).toContain(
      'alter table "public"."event_participant_role" validate constraint "event_participant_role_event_participant_id_fkey";'
    );
  });
});

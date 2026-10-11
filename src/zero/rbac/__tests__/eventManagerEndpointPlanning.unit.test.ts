import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { queryAST } from '../../../../tools/e2e/zero-performance/oracle';
import {
  buildQuery,
  loadCases,
  OWNER,
  OUTSIDER,
} from '../../../../tools/e2e/zero-performance/catalog';
import {
  applyAmendmentQueryAccess,
  applyDocumentQueryAccess,
  applyElectionElectorOrManagerQueryAccess,
  applyElectionManagerQueryAccess,
  applyEventManagerQueryAccess,
  applyGroupDiscoveryQueryAccess,
  applyGroupManagerQueryAccess,
  applyTutorialRunOwnerQueryAccess,
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

describe('single amendment document access planning', () => {
  it.each([OWNER, OUTSIDER, { userID: 'anon', email: '' }])(
    'keeps the singular document and all access predicates while starting from its primary key for $userID',
    ctx => {
      const entry = loadCases().find(
        entry => entry.name === 'amendments.documentById' && entry.variant === 'default'
      )!;
      const query = buildQuery(entry, ctx);
      const actual = queryAST(query);
      const original = queryAST(
        applyDocumentQueryAccess(
          zql.document.where('id', (entry.args as { id: string }).id),
          ctx.userID
        ).one()
      );
      expect(canonical(actual)).toEqual(canonical(original));
      expect(actual).toMatchObject({ table: 'document', limit: 1 });
      expect((query as any).format.singular).toBe(true);
      const rootPermissions: any[] = [];
      const visit = (condition: any) => {
        if (condition.type === 'correlatedSubquery') rootPermissions.push(condition);
        else condition.conditions?.forEach(visit);
      };
      visit(actual.where);
      expect(rootPermissions).toHaveLength(ctx.userID === 'anon' ? 1 : 3);
      for (const permission of rootPermissions) expect(permission.flip).toBe(false);
    }
  );
});

function originalGroupRights(q: any, userID: string, discovery: boolean) {
  const actions = discovery ? ['view', 'manage'] : ['manage'];
  const membershipStatuses = discovery
    ? ['invited', 'active', 'member', 'admin']
    : ['active', 'member', 'admin'];
  const guestStatuses = discovery ? ['invited', 'active'] : ['active'];
  const withRole = (link: any) =>
    link.whereExists(
      'role',
      (role: any) =>
        role
          .where('scope', 'group')
          .whereExists(
            'action_rights',
            (right: any) =>
              whereAnyOf(whereAnyOf(right, 'resource', ['groups']), 'action', actions),
            { flip: false }
          ),
      { flip: false }
    );
  return q.where(({ or, cmp, exists }: any) =>
    or(
      ...(discovery
        ? [or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated'))]
        : []),
      cmp('owner_id', userID),
      exists(
        'memberships',
        (membership: any) =>
          whereAnyOf(membership.where('user_id', userID), 'status', membershipStatuses).whereExists(
            'membership_roles',
            withRole,
            { flip: false }
          ),
        { flip: false }
      ),
      exists(
        'guest_accesses',
        (guest: any) =>
          whereAnyOf(guest.where('user_id', userID), 'status', guestStatuses).whereExists(
            'guest_roles',
            withRole,
            { flip: false }
          ),
        { flip: false }
      )
    )
  );
}

describe('group role indexed endpoints', () => {
  it.each([true, false])('preserves original access predicates for discovery=%s', discovery => {
    for (const userID of ['owner', 'outsider']) {
      const actual = queryAST(
        discovery
          ? applyGroupDiscoveryQueryAccess(zql.group, userID)
          : applyGroupManagerQueryAccess(zql.group, userID)
      );
      const original = originalGroupRights(
        discovery ? applyTutorialRunOwnerQueryAccess(zql.group, userID) : zql.group,
        userID,
        discovery
      );
      expect(canonical(actual)).toEqual(canonical(queryAST(original)));
      const endpoints: any[] = [];
      const visit = (value: any) => {
        if (value?.type === 'correlatedSubquery' && value.flip === true) endpoints.push(value);
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') Object.values(value).forEach(visit);
      };
      visit(actual);
      expect(endpoints).toHaveLength(2);
      for (const endpoint of endpoints)
        expect(endpoint).toMatchObject({
          op: 'EXISTS',
          related: {
            subquery: { table: 'role' },
            correlation: { parentField: ['role_id'], childField: ['id'] },
          },
        });
    }
  });
  it('requires the indexed role key and validated membership and guest foreign keys', () => {
    const migration = readFileSync('supabase/migrations/20260922043912_initial_reset.sql', 'utf8');
    expect(migration).toContain(
      'alter table "public"."role" add constraint "role_pkey" PRIMARY KEY using index "role_pkey";'
    );
    for (const link of ['group_membership_role', 'group_guest_role']) {
      expect(migration).toContain(
        `alter table "public"."${link}" validate constraint "${link}_role_id_fkey";`
      );
    }
  });
});

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

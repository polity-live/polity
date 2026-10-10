import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { queryAST } from '../../../../tools/e2e/zero-performance/oracle';
import { applyEventManagerQueryAccess } from '../query-access';
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

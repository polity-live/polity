import { describe, expect, it } from 'vitest';

import {
  countVoteChoices,
  compareDecisionItems,
  dedupeRowsById,
  getCandidateDisplayName,
  getUserFullName,
  hasConfirmedEventRole,
  mapClosedVoteResult,
  mergeDecisionAgendaTimingSource,
  normalizeMajorityType,
} from '../useDecisionTerminal';

describe('useDecisionTerminal helpers', () => {
  it('normalizes majority and closed result variants', () => {
    expect(normalizeMajorityType('absolute')).toBe('absolute');
    expect(normalizeMajorityType('two_thirds')).toBe('two_thirds');
    expect(normalizeMajorityType('unexpected')).toBe('simple');
    expect(normalizeMajorityType()).toBe('simple');
    expect(mapClosedVoteResult('rejected')).toBe('failed');
    expect(mapClosedVoteResult('tie')).toBe('tied');
    expect(mapClosedVoteResult('passed')).toBe('passed');
    expect(mapClosedVoteResult('unexpected' as any)).toBe('passed');
  });

  it('counts ordered indicative and final choices including sparse data', () => {
    const vote = {
      choices: [
        { id: 'oppose', order_index: 1 },
        { id: 'support', order_index: null },
        { id: 'abstain', order_index: 2 },
      ],
      indicative_decisions: [
        { choice_id: 'support' },
        { choice_id: 'support' },
        { choice_id: 'oppose' },
      ],
      final_decisions: [{ choice_id: 'abstain' }],
    } as any;
    expect(countVoteChoices(vote, 'indicative')).toEqual({ support: 2, oppose: 1, abstain: 0 });
    expect(countVoteChoices(vote, 'final')).toEqual({ support: 0, oppose: 0, abstain: 1 });

    expect(countVoteChoices({} as any, 'indicative')).toEqual({
      support: 0,
      oppose: 0,
      abstain: 0,
    });
    expect(countVoteChoices({ choices: [], final_decisions: [] } as any, 'final')).toEqual({
      support: 0,
      oppose: 0,
      abstain: 0,
    });
    expect(countVoteChoices({ choices: [] } as any, 'final')).toEqual({
      support: 0,
      oppose: 0,
      abstain: 0,
    });
  });

  it('builds candidate names through every fallback', () => {
    expect(getUserFullName({ first_name: 'Ada', last_name: 'Lovelace' } as any)).toBe(
      'Ada Lovelace'
    );
    expect(getUserFullName({ first_name: '', last_name: '' } as any)).toBeNull();
    expect(getUserFullName(null)).toBeNull();
    expect(getCandidateDisplayName({ user: { first_name: 'Ada' }, name: 'Fallback' } as any)).toBe(
      'Ada'
    );
    expect(getCandidateDisplayName({ user: null, name: '  Grace  ' } as any)).toBe('Grace');
    expect(getCandidateDisplayName({ user: null, name: '   ' } as any)).toBe('Candidate');
  });

  it('requires a confirmed matching participant role', () => {
    expect(hasConfirmedEventRole(null, 'user-1')).toBe(false);
    expect(hasConfirmedEventRole({ participants: [] }, undefined)).toBe(false);
    expect(hasConfirmedEventRole({}, 'user-1')).toBe(false);
    const event = {
      participants: [
        { user_id: 'other', status: 'active', participant_roles: [{}] },
        { user_id: 'user-1', status: null, participant_roles: [{}] },
        { user_id: 'user-1', status: 'active', participant_roles: null },
        { user_id: 'user-1', status: 'confirmed', participant_roles: [{}] },
      ],
    };
    expect(hasConfirmedEventRole(event, 'user-1')).toBe(true);
    expect(
      hasConfirmedEventRole(
        { participants: [{ user_id: 'user-1', status: 'blocked', participant_roles: [] }] },
        'user-1'
      )
    ).toBe(false);
  });

  it('merges calculated agenda timing over source timing and handles absent values', () => {
    expect(mergeDecisionAgendaTimingSource(null, undefined)).toBeNull();
    const source = {
      status: 'source',
      duration: 1,
      activated_at: 2,
      completed_at: 3,
      start_time: 4,
      end_time: 5,
    } as any;
    expect(mergeDecisionAgendaTimingSource(source, null)).toMatchObject(source);
    const calculated = {
      status: 'calculated',
      duration: 10,
      activated_at: 20,
      completed_at: 30,
      start_time: 40,
      end_time: 50,
      calculated_start_time: 60,
      calculated_end_time: 70,
    } as any;
    expect(mergeDecisionAgendaTimingSource(source, calculated)).toEqual(calculated);
  });

  it('deduplicates rows while preserving first-seen order', () => {
    expect(
      dedupeRowsById([
        { id: 'a', value: 1 },
        { id: 'a', value: 2 },
        { id: 'b', value: 3 },
      ])
    ).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 3 },
    ]);
  });

  it('sorts explicit and legacy temporal buckets with every timestamp fallback', () => {
    const item = (overrides: Record<string, unknown>) =>
      ({
        id: String(overrides.id ?? 'item'),
        type: 'vote',
        title: 'Vote',
        body: 'Body',
        endsAt: '2026-01-03T00:00:00.000Z',
        status: 'active',
        visibility: 'public',
        trend: { direction: 'stable', percentage: 0 },
        isClosed: false,
        ...overrides,
      }) as any;
    expect(
      compareDecisionItems(item({ temporalBucket: 'active' }), item({ temporalBucket: 'past' }))
    ).toBeLessThan(0);
    expect(
      compareDecisionItems(
        item({ temporalBucket: undefined, isClosed: false }),
        item({ temporalBucket: undefined, isClosed: true })
      )
    ).toBeLessThan(0);
    expect(
      compareDecisionItems(
        item({ temporalBucket: 'active' }),
        item({ temporalBucket: undefined, isClosed: false })
      )
    ).toBe(0);
    expect(
      compareDecisionItems(
        item({ temporalBucket: 'future', sortStartsAt: '2026-01-01T00:00:00.000Z' }),
        item({ temporalBucket: 'future', startsAt: '2026-01-02T00:00:00.000Z' })
      )
    ).toBeLessThan(0);
    expect(
      compareDecisionItems(
        item({ temporalBucket: 'future', startsAt: null, sortStartsAt: null }),
        item({
          temporalBucket: 'future',
          startsAt: null,
          sortStartsAt: null,
          endsAt: '2026-01-04T00:00:00.000Z',
        })
      )
    ).toBeLessThan(0);
    expect(
      compareDecisionItems(
        item({ temporalBucket: 'past', sortEndsAt: '2026-01-01T00:00:00.000Z' }),
        item({ temporalBucket: 'past', sortEndsAt: null, endsAt: '2026-01-02T00:00:00.000Z' })
      )
    ).toBeGreaterThan(0);
    expect(
      compareDecisionItems(
        item({ temporalBucket: 'active', sortEndsAt: null, endsAt: '2026-01-01T00:00:00.000Z' }),
        item({ temporalBucket: 'active', sortEndsAt: '2026-01-02T00:00:00.000Z' })
      )
    ).toBeLessThan(0);
  });
});

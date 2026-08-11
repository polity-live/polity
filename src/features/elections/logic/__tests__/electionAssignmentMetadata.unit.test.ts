import { describe, expect, it, vi } from 'vitest';

import {
  buildDelegateElectionDescription,
  buildDelegateSeatRoleDescription,
  buildDelegateSeatRoleName,
  DELEGATE_ELECTION_METADATA_PREFIX,
  parseDelegateElectionMetadata,
  stripDelegateElectionMetadata,
  type DelegateElectionAssignmentMeta,
} from '../electionAssignmentMetadata';

const translate = vi.hoisted(() =>
  vi.fn((key: string, values?: object) => (values ? `${key}:${JSON.stringify(values)}` : key))
);

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: object) => translate(key, values),
}));

const validMeta: DelegateElectionAssignmentMeta = {
  kind: 'delegate_election',
  targetEventId: 'event-1',
  targetGroupId: 'target-1',
  sourceGroupId: 'source-1',
  seatRoleIds: ['seat-1'],
  allSeatRoleIds: ['seat-1', 'seat-2'],
  mode: 'single',
};

const descriptionFor = (meta: unknown) =>
  `${DELEGATE_ELECTION_METADATA_PREFIX}${JSON.stringify(meta)}`;

describe('electionAssignmentMetadata', () => {
  it('builds a metadata-first description with an optional trimmed summary', () => {
    const withSummary = buildDelegateElectionDescription({ summary: ' Summary ', meta: validMeta });
    expect(withSummary).toBe(`${descriptionFor(validMeta)}\nSummary`);
    expect(buildDelegateElectionDescription({ summary: ' ', meta: validMeta })).toBe(
      descriptionFor(validMeta)
    );
    expect(buildDelegateElectionDescription({ meta: validMeta })).toBe(descriptionFor(validMeta));
  });

  it('parses valid metadata and filters invalid role ids', () => {
    expect(
      parseDelegateElectionMetadata(
        `${descriptionFor({
          ...validMeta,
          seatRoleIds: ['seat-1', '', 2],
          allSeatRoleIds: ['seat-1', null, 'seat-2'],
          mode: 'list',
        })}\r\nVisible summary`
      )
    ).toEqual({ ...validMeta, seatRoleIds: ['seat-1'], mode: 'list' });
  });

  it.each([
    null,
    '',
    'Visible description',
    `${DELEGATE_ELECTION_METADATA_PREFIX}{broken`,
    descriptionFor({ ...validMeta, kind: 'other' }),
    descriptionFor({ ...validMeta, targetEventId: 1 }),
    descriptionFor({ ...validMeta, targetGroupId: null }),
    descriptionFor({ ...validMeta, sourceGroupId: false }),
    descriptionFor({ ...validMeta, seatRoleIds: 'seat-1' }),
    descriptionFor({ ...validMeta, allSeatRoleIds: {} }),
    descriptionFor({ ...validMeta, mode: 'other' }),
  ])('rejects malformed metadata %#', description => {
    expect(parseDelegateElectionMetadata(description)).toBeNull();
  });

  it('strips metadata while preserving normal descriptions', () => {
    expect(stripDelegateElectionMetadata(null)).toBeNull();
    expect(stripDelegateElectionMetadata('Normal description')).toBe('Normal description');
    expect(stripDelegateElectionMetadata(descriptionFor(validMeta))).toBeNull();
    expect(
      stripDelegateElectionMetadata(`${descriptionFor(validMeta)}\n\n Visible summary \n`)
    ).toBe('Visible summary');
  });

  it('builds seat role names with provided and fallback event titles', () => {
    expect(buildDelegateSeatRoleName(' Assembly ', 2)).toContain('"event":"Assembly"');
    expect(buildDelegateSeatRoleName(' ', 1)).toContain(
      '"event":"features.elections.delegate.assemblyFallback"'
    );
  });

  it('builds descriptions with normalized inputs and translated fallbacks', () => {
    expect(
      buildDelegateSeatRoleDescription({
        sourceGroupName: ' Source ',
        targetGroupName: ' Target ',
        eventTitle: ' Event ',
        seatNumber: 2,
        totalSeats: 4,
      })
    ).toContain('"sourceGroup":"Source","targetGroup":"Target","event":"Event"');

    const fallback = buildDelegateSeatRoleDescription({ seatNumber: 1, totalSeats: 1 });
    expect(fallback).toContain('generated.inline.0055_die_delegiertenversammlung_9744e078');
    expect(fallback).toContain('features.elections.delegate.sourceGroupFallback');
    expect(fallback).toContain('features.elections.delegate.targetGroupFallback');
  });
});

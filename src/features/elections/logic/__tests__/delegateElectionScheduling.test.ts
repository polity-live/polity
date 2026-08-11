import { describe, expect, it, vi } from 'vitest';

import { buildDelegateElectionDescription } from '../electionAssignmentMetadata';
import {
  buildDelegateElectionAgendaItemDescription,
  buildDelegateElectionAgendaItemTitle,
  buildDelegateElectionRecordDescription,
  buildDelegateElectionRecordTitle,
  buildDelegateSeatRoleInput,
  collectExistingDelegateSeatRoleIds,
} from '../delegateElectionScheduling';

const translate = vi.hoisted(() =>
  vi.fn((key: string, values?: object) => (values ? `${key}:${JSON.stringify(values)}` : key))
);

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: object) => translate(key, values),
}));

const metadataDescription = (
  overrides: Partial<Parameters<typeof buildDelegateElectionDescription>[0]['meta']> = {}
) =>
  buildDelegateElectionDescription({
    meta: {
      kind: 'delegate_election',
      targetEventId: 'event-1',
      targetGroupId: 'target-1',
      sourceGroupId: 'source-1',
      seatRoleIds: ['seat-1'],
      allSeatRoleIds: ['seat-1', 'seat-2'],
      mode: 'single',
      ...overrides,
    },
  });

describe('delegateElectionScheduling', () => {
  it('collects matching role ids once and ignores unrelated or invalid elections', () => {
    expect(
      collectExistingDelegateSeatRoleIds(
        [
          { elections: null },
          { elections: [{ description: null }, { description: 'invalid' }] },
          { elections: [{ description: metadataDescription({ sourceGroupId: 'other' }) }] },
          { elections: [{ description: metadataDescription({ targetEventId: 'other' }) }] },
          { elections: [{ description: metadataDescription() }] },
          {
            elections: [
              { description: metadataDescription({ allSeatRoleIds: ['seat-2', 'seat-3'] }) },
            ],
          },
        ],
        'source-1',
        'event-1'
      )
    ).toEqual(['seat-1', 'seat-2', 'seat-3']);
  });

  it('builds the role input through the shared naming contract', () => {
    const input = buildDelegateSeatRoleInput({
      sourceGroupName: 'Source',
      targetGroupName: 'Target',
      targetEventTitle: 'Assembly',
      seatNumber: 2,
      totalSeats: 3,
    });
    expect(input.name).toContain('features.elections.delegate.seatRoleName');
    expect(input.name).toContain('"seat":2');
    expect(input.description).toContain('features.elections.delegate.seatRoleDescription');
  });

  it('builds list and single agenda titles with provided and fallback values', () => {
    expect(
      buildDelegateElectionAgendaItemTitle({ mode: 'list', targetEventTitle: 'Assembly' })
    ).toContain('features.elections.delegate.agendaListTitle');
    expect(buildDelegateElectionAgendaItemTitle({ mode: 'list' })).toContain(
      'features.elections.delegate.assemblyFallback'
    );
    expect(
      buildDelegateElectionAgendaItemTitle({ mode: 'single', seatNumber: 2, targetEventTitle: '' })
    ).toContain('"seat":2');
    expect(buildDelegateElectionAgendaItemTitle({ mode: 'single' })).toContain('"seat":1');
  });

  it('builds list and single agenda descriptions', () => {
    expect(
      buildDelegateElectionAgendaItemDescription({ mode: 'list', seatCount: 3, totalSeatCount: 5 })
    ).toContain('"count":3');
    expect(
      buildDelegateElectionAgendaItemDescription({
        mode: 'single',
        seatCount: 1,
        totalSeatCount: 5,
        seatNumber: 3,
      })
    ).toContain('"seat":3,"total":5');
    expect(
      buildDelegateElectionAgendaItemDescription({
        mode: 'single',
        seatCount: 1,
        totalSeatCount: 1,
      })
    ).toContain('"seat":1');
  });

  it('builds list and single record titles', () => {
    expect(
      buildDelegateElectionRecordTitle({ mode: 'list', targetEventTitle: 'Assembly' })
    ).toContain('features.elections.delegate.recordListTitle');
    expect(buildDelegateElectionRecordTitle({ mode: 'list' })).toContain(
      'features.elections.delegate.assemblyFallback'
    );
    expect(buildDelegateElectionRecordTitle({ mode: 'single', seatNumber: 4 })).toContain(
      '"seat":4'
    );
    expect(
      buildDelegateElectionRecordTitle({ mode: 'single', targetEventTitle: 'Event' })
    ).toContain('"seat":1');
  });

  it('encodes record summary and assignment metadata with fallbacks', () => {
    const description = buildDelegateElectionRecordDescription({
      sourceGroupId: 'source-1',
      targetGroupId: 'target-1',
      targetEventId: 'event-1',
      seatRoleIds: ['seat-1'],
      allSeatRoleIds: ['seat-1', 'seat-2'],
      mode: 'list',
    });
    expect(description).toContain('features.elections.delegate.sourceGroupFallback');
    expect(description).toContain('features.elections.delegate.assemblyFallback');
    expect(description).toContain('"targetEventId":"event-1"');

    expect(
      buildDelegateElectionRecordDescription({
        sourceGroupId: 'source-2',
        sourceGroupName: 'Source',
        targetGroupId: 'target-2',
        targetEventId: 'event-2',
        targetEventTitle: 'Assembly',
        seatRoleIds: [],
        allSeatRoleIds: [],
        mode: 'single',
      })
    ).toContain('"sourceGroup":"Source","event":"Assembly"');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildAmendmentForwardingPreview,
  deriveAmendmentForwardingStatus,
} from '../amendmentForwardingPreview';

describe('amendment forwarding preview', () => {
  const materializedTarget = {
    agenda_item_id: 'agenda-next',
    vote_id: 'vote-next',
    target_group: { id: 'group-next', name: 'H1' },
    event: { id: 'event-next', title: 'EH1', start_date: 123 },
  };

  it('stays pending until an approved step has a materialized target ballot', () => {
    expect(deriveAmendmentForwardingStatus({ status: 'scheduled' }, materializedTarget)).toBe(
      'pending'
    );
    expect(
      deriveAmendmentForwardingStatus(
        { status: 'approved', decision_status: 'approved' },
        { ...materializedTarget, vote_id: null }
      )
    ).toBe('pending');
  });

  it('marks an approved step with target agenda item and vote as forwarded', () => {
    expect(
      deriveAmendmentForwardingStatus(
        { status: 'approved', decision_status: 'approved' },
        materializedTarget
      )
    ).toBe('forwarded');
  });

  it.each([
    ['rejected', 'rejected'],
    ['tie', 'tie'],
  ] as const)('preserves the %s process decision', (decisionStatus, expected) => {
    expect(
      deriveAmendmentForwardingStatus(
        { status: decisionStatus, decision_status: decisionStatus },
        materializedTarget
      )
    ).toBe(expected);
  });

  it('builds the shared destination model from the process step runs', () => {
    expect(
      buildAmendmentForwardingPreview({
        amendmentId: 'amendment-1',
        currentStepRun: { status: 'approved', decision_status: 'approved' },
        nextStepRun: materializedTarget,
      })
    ).toEqual({
      status: 'forwarded',
      nextGroupId: 'group-next',
      nextGroupName: 'H1',
      nextEventId: 'event-next',
      nextEventTitle: 'EH1',
      nextEventStartDate: 123,
    });
  });
});

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
    expect(
      deriveAmendmentForwardingStatus({ decision_status: 'approved' }, materializedTarget)
    ).toBe('forwarded');
  });

  it('stays pending for absent steps and partially materialized targets', () => {
    expect(deriveAmendmentForwardingStatus(undefined, undefined)).toBe('pending');
    expect(
      deriveAmendmentForwardingStatus(
        { status: 'approved' },
        { ...materializedTarget, agenda_item_id: null }
      )
    ).toBe('pending');
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

  it('requires an amendment and event and defaults optional destination fields', () => {
    expect(buildAmendmentForwardingPreview({ nextStepRun: materializedTarget })).toBeNull();
    expect(
      buildAmendmentForwardingPreview({
        amendmentId: 'amendment-1',
        nextStepRun: { ...materializedTarget, event: null },
      })
    ).toBeNull();
    expect(
      buildAmendmentForwardingPreview({
        amendmentId: 'amendment-1',
        nextStepRun: { event: {} },
      })
    ).toEqual({
      status: 'pending',
      nextGroupId: null,
      nextGroupName: null,
      nextEventId: null,
      nextEventTitle: 'Next event',
      nextEventStartDate: null,
    });
  });
});

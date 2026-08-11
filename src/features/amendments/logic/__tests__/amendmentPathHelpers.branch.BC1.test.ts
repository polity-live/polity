import { describe, expect, it } from 'vitest';

import {
  amendmentPathHelperInternals,
  getWorkflowFinalGroupId,
  getWorkflowStartGroupId,
} from '../amendmentPathHelpers';

describe('amendment path fallback contracts', () => {
  it('returns null when a populated group event list has no eligible event', () => {
    expect(
      amendmentPathHelperInternals.findClosestEligibleEvent({
        eventsByGroupId: new Map([
          [
            'group-a',
            [
              {
                id: 'event-without-start',
                group_id: 'group-a',
                start_date: null,
                end_date: null,
                status: 'active',
              },
            ],
          ],
        ]) as never,
        groupId: 'group-a',
      })
    ).toBeNull();
  });

  it('falls back from a missing first workflow-step group to the workflow group and null', () => {
    const missingFirstGroup = [{ group_id: null, order_index: 0 }] as never;

    expect(getWorkflowStartGroupId({ group_id: 'workflow-group', steps: missingFirstGroup })).toBe(
      'workflow-group'
    );
    expect(getWorkflowStartGroupId({ group_id: null, steps: missingFirstGroup })).toBeNull();
  });

  it('falls back from a missing final workflow-step group to the workflow group and null', () => {
    const missingFinalGroup = [{ group_id: null, order_index: 0 }] as never;

    expect(getWorkflowFinalGroupId({ group_id: 'workflow-group', steps: missingFinalGroup })).toBe(
      'workflow-group'
    );
    expect(getWorkflowFinalGroupId({ group_id: null, steps: missingFinalGroup })).toBeNull();
  });
});

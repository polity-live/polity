import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/groups/logic/delegateElectionScheduling', () => ({
  buildCreateEventSearchFromDelegateElectionAssignment: () => ({}),
}));
vi.mock('@/features/amendments/logic/processTaskEventScheduling', () => ({
  getSchedulingWindowDisplayLabel: (value: unknown) => JSON.stringify(value),
}));

import { openAssignmentsPanelInternals } from '../OpenAssignmentsPanel';

describe('OpenAssignmentsPanel scheduling fallback', () => {
  it('normalizes absent delegate minimum scheduling fields to null', () => {
    const label = openAssignmentsPanelInternals.getAssignmentSchedulingWindowLabel(
      { id: 'delegate', kind: 'delegate_election' } as any,
      'group'
    );
    expect(label).toContain('"minStartDate":null');
    expect(label).toContain('"minStartTime":null');
  });
});

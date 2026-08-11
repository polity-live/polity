import { describe, expect, it } from 'vitest';

import {
  formatWorkflowStepSequence,
  getNextStepOrderIndex,
  getWorkflowGroupIds,
  isWorkflowCircular,
  isWorkflowValid,
  reindexSteps,
  sortWorkflowSteps,
} from '../workflowHelpers';

function workflow(steps: any[]) {
  return { id: 'workflow-1', steps } as any;
}

describe('workflowHelpers', () => {
  const steps = [
    { id: 's2', order_index: 2, group_id: 'g1', group: { name: 'Plenum' } },
    { id: 's0', order_index: 0, group_id: 'g1', label: 'Opening' },
    { id: 's1', order_index: 1, group_id: 'g2', label: 'Committee' },
  ] as any[];

  it('sorts without mutating, extracts IDs and reindexes', () => {
    expect(sortWorkflowSteps(steps).map(step => step.id)).toEqual(['s0', 's1', 's2']);
    expect(steps.map(step => step.id)).toEqual(['s2', 's0', 's1']);
    expect(getWorkflowGroupIds(workflow(steps))).toEqual(['g1', 'g2', 'g1']);
    expect(reindexSteps(steps)).toEqual([
      { id: 's0', order_index: 0 },
      { id: 's1', order_index: 1 },
      { id: 's2', order_index: 2 },
    ]);
  });

  it('validates length, circularity and next indexes at their boundaries', () => {
    expect(isWorkflowValid(workflow([]))).toBe(false);
    expect(isWorkflowValid(workflow(steps))).toBe(true);
    expect(isWorkflowCircular(workflow([{ id: 'one', order_index: 0, group_id: 'g1' }]))).toBe(
      false
    );
    expect(isWorkflowCircular(workflow(steps))).toBe(true);
    expect(
      isWorkflowCircular(
        workflow([
          { id: 'first', order_index: 0, group_id: 'g1' },
          { id: 'second', order_index: 1, group_id: 'g2' },
        ])
      )
    ).toBe(false);
    expect(getNextStepOrderIndex([])).toBe(0);
    expect(getNextStepOrderIndex(steps as any)).toBe(3);
  });

  it('formats group names, labels and generated step fallbacks', () => {
    expect(
      formatWorkflowStepSequence(
        workflow([
          { id: 'a', order_index: 0, group_id: 'g1', group: { name: 'Group' } },
          { id: 'b', order_index: 1, group_id: 'g2', label: 'Label' },
          { id: 'c', order_index: 2, group_id: 'g3' },
        ])
      )
    ).toBe('Group → Label → Step 3');
  });
});

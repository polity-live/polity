import { describe, expect, it } from 'vitest';
import {
  getDefaultWorkflowId,
  sortWorkflowsByName,
  toWorkflowVisualizationWorkflow,
} from '../workflowVisualizationHelpers';

function buildWorkflow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Workflow ${id}`,
    description: null,
    status: 'pending_approval',
    start_group_id: 'start-group',
    start_group: { id: 'start-group', name: 'Start Group' },
    steps: [],
    approvals: [],
    ...overrides,
  };
}

describe('workflowVisualizationHelpers', () => {
  it('sorts workflows alphabetically by name', () => {
    const workflows = [
      buildWorkflow('z', { name: 'Zulu Workflow' }),
      buildWorkflow('a', { name: 'Alpha Workflow' }),
    ];

    expect(sortWorkflowsByName(workflows).map(workflow => workflow.id)).toEqual(['a', 'z']);
  });

  it('defaults to the first alphabetically sorted workflow when none is selected', () => {
    const workflows = sortWorkflowsByName([
      buildWorkflow('z', { name: 'Zulu Workflow' }),
      buildWorkflow('a', { name: 'Alpha Workflow' }),
    ]);

    expect(getDefaultWorkflowId(workflows, '')).toBe('a');
    expect(getDefaultWorkflowId(workflows, 'z')).toBe('z');
    expect(getDefaultWorkflowId(workflows, 'missing')).toBe('a');
  });

  it('normalizes the start group and approval state for workflow visualization', () => {
    const workflow = buildWorkflow('a', {
      name: 'Alpha Workflow',
      status: 'active',
      start_group_id: 'alpha-start',
      start_group: { id: 'alpha-start', name: 'Alpha Start' },
      steps: [
        {
          id: 'step-1',
          order_index: 0,
          label: null,
          group_id: 'target-group',
          group: { id: 'target-group', name: 'Target Group' },
        },
      ],
    });

    expect(toWorkflowVisualizationWorkflow(workflow)).toEqual(
      expect.objectContaining({
        name: 'Alpha Workflow',
        approvalState: 'accepted',
        startGroup: {
          id: 'alpha-start',
          name: 'Alpha Start',
        },
        steps: [
          expect.objectContaining({
            id: 'step-1',
            group_id: 'target-group',
          }),
        ],
      })
    );
  });
});

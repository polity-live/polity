import { describe, expect, it } from 'vitest';
import {
  getDefaultWorkflowId,
  sortWorkflowsByName,
  toWorkflowVisualizationWorkflow,
} from '../workflowVisualizationHelpers';

function buildWorkflow(id: string, overrides: Record<string, unknown> = {}): any {
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
    expect(getDefaultWorkflowId([], 'missing')).toBe('');
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

  it('sorts missing names and maps minimal pending workflows', () => {
    expect(
      sortWorkflowsByName([
        buildWorkflow('named', { name: 'Alpha' }),
        buildWorkflow('missing-left', { name: null }),
        buildWorkflow('missing-right', { name: undefined }),
      ])
    ).toHaveLength(3);

    expect(
      toWorkflowVisualizationWorkflow(
        buildWorkflow('minimal', {
          description: undefined,
          status: 'pending_approval',
          start_group_id: null,
          start_group: null,
          steps: null,
        })
      )
    ).toMatchObject({
      description: null,
      startGroup: null,
      approvalState: 'pending',
      steps: [],
    });
  });

  it('falls back to the stored start-group id and maps steps without joined groups', () => {
    expect(
      toWorkflowVisualizationWorkflow(
        buildWorkflow('fallback', {
          start_group_id: 'stored-group',
          start_group: null,
          steps: [
            {
              id: 'step',
              order_index: null,
              label: null,
              group_id: 'group',
              group: null,
            },
          ],
        })
      )
    ).toMatchObject({
      startGroup: { id: 'stored-group', name: 'stored-group' },
      steps: [{ id: 'step', group: null }],
    });
  });
});

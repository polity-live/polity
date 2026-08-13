import { beforeEach, describe, expect, it, vi } from 'vitest';

const helperState = vi.hoisted(() => ({ relationships: [] as any[] }));

vi.mock('../../schema', () => {
  const make = (table: string, filters: unknown[] = [], single = false): any => ({
    table,
    filters,
    single,
    where: (...args: unknown[]) => make(table, [...filters, args], single),
    one: () => make(table, filters, true),
  });
  return {
    zql: new Proxy({}, { get: (_target, table: string) => make(table) }),
  };
});

vi.mock('../derived', () => ({
  deriveGroupRelationships: () => helperState.relationships,
}));

import {
  approveWorkflowApproval,
  deleteWorkflowDefinition,
  rejectWorkflowApproval,
  saveWorkflowDefinition,
  type SaveWorkflowDefinitionInput,
  type WorkflowDraftStepInput,
} from '../workflow-mutator-helpers';

function step(
  groupId: string,
  overrides: Partial<WorkflowDraftStepInput> = {}
): WorkflowDraftStepInput {
  return {
    id: `${groupId}-step`,
    group_id: groupId,
    order_index: 0,
    label: null,
    step_kind: 'group_vote',
    selection_mode: 'default_target_workflow',
    merge_strategy: null,
    event_rule: null,
    auto_task_on_missing_event: false,
    target_workflow_id: null,
    ...overrides,
  };
}

function definition(
  overrides: Partial<SaveWorkflowDefinitionInput> = {}
): SaveWorkflowDefinitionInput {
  return {
    id: 'workflow-1',
    editing_group_id: 'start-group',
    start_group_id: 'start-group',
    name: 'Workflow',
    description: 'Description',
    is_default_entry: false,
    created_by_id: 'user-1',
    steps: [step('final-group')],
    ...overrides,
  };
}

function createTx(responses: Record<string, unknown[]> = {}) {
  return {
    run: vi.fn(async (query: { table: string; single?: boolean }) => {
      const queue = responses[query.table] ?? [];
      return queue.shift() ?? (query.single ? null : []);
    }),
    mutate: {
      group_workflow: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      group_workflow_approval: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      group_workflow_step: { insert: vi.fn(), delete: vi.fn() },
    },
  };
}

beforeEach(() => {
  helperState.relationships = [
    {
      group_id: 'start-group',
      related_group_id: 'middle-group',
      with_right: 'amendmentRight',
    },
    {
      group_id: 'middle-group',
      related_group_id: 'final-group',
      with_right: 'amendmentRight',
    },
    {
      group_id: 'start-group',
      related_group_id: 'final-group',
      with_right: 'amendmentRight',
    },
    { group_id: 'start-group', related_group_id: 'ignored', with_right: 'informationRight' },
  ];
  vi.clearAllMocks();
});

describe('workflow mutator helpers', () => {
  it('creates a default workflow, clears siblings, replaces children, and preserves step order', async () => {
    const tx = createTx({
      group: [
        [
          { id: 'start-group', name: ' Start ' },
          { id: 'middle-group', name: '   ' },
          { id: 'final-group', name: null },
        ],
      ],
      group_connection: [[]],
      group_right_grant: [[]],
      group_membership_rule: [[]],
      group_workflow: [
        null,
        [
          { id: 'workflow-1', is_default_entry: true },
          { id: 'not-default', is_default_entry: false },
          { id: 'old-default', is_default_entry: true },
        ],
      ],
      group_workflow_approval: [[{ id: 'old-approval' }]],
      group_workflow_step: [[{ id: 'old-step' }]],
    });
    const args = definition({
      is_default_entry: true,
      steps: [
        step('final-group', {
          id: undefined,
          order_index: 2,
          label: undefined as never,
          merge_strategy: undefined as never,
          event_rule: undefined as never,
          target_workflow_id: undefined as never,
        }),
        step('middle-group', {
          order_index: 1,
          label: 'Review',
          merge_strategy: 'winner_continues',
          event_rule: 'required',
          target_workflow_id: 'target',
        }),
      ],
    });

    await saveWorkflowDefinition(tx as never, args);

    expect(tx.mutate.group_workflow.insert).toHaveBeenCalledOnce();
    expect(tx.mutate.group_workflow.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'old-default', is_default_entry: false })
    );
    expect(tx.mutate.group_workflow_approval.delete).toHaveBeenCalledWith({ id: 'old-approval' });
    expect(tx.mutate.group_workflow_approval.insert).toHaveBeenCalledTimes(3);
    expect(tx.mutate.group_workflow_step.delete).toHaveBeenCalledWith({ id: 'old-step' });
    expect(tx.mutate.group_workflow_step.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.group_workflow.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'workflow-1', status: 'pending_approval' })
    );
  });

  it('updates an existing workflow and activates a single-participant definition', async () => {
    helperState.relationships = [
      { group_id: 'start-group', related_group_id: 'start-group', with_right: 'amendmentRight' },
    ];
    const tx = createTx({
      group: [[{ id: 'start-group', name: 'Start' }]],
      group_connection: [[]],
      group_right_grant: [[]],
      group_membership_rule: [[]],
      group_workflow: [{ id: 'workflow-1' }],
      group_workflow_approval: [[]],
      group_workflow_step: [[]],
    });
    await saveWorkflowDefinition(
      tx as never,
      definition({ steps: [step('start-group')], is_default_entry: false })
    );
    expect(tx.mutate.group_workflow.insert).not.toHaveBeenCalled();
    expect(tx.mutate.group_workflow.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
  });

  it('rejects empty, non-participating, and disconnected definitions', async () => {
    await expect(
      saveWorkflowDefinition(createTx() as never, definition({ steps: [] }))
    ).rejects.toThrow('at least one step');

    const nonParticipantTx = createTx({
      group: [
        [
          { id: 'start-group', name: 'Start' },
          { id: 'final-group', name: 'Final' },
        ],
      ],
    });
    await expect(
      saveWorkflowDefinition(
        nonParticipantTx as never,
        definition({ editing_group_id: 'outside-group' })
      )
    ).rejects.toThrow('must participate');

    helperState.relationships = [];
    const disconnectedTx = createTx({
      group: [[{ id: 'start-group', name: 'Start' }]],
      group_connection: [[]],
      group_right_grant: [[]],
      group_membership_rule: [[]],
    });
    await expect(saveWorkflowDefinition(disconnectedTx as never, definition())).rejects.toThrow(
      'No direct amendment-right transition'
    );
  });

  it('validates every explicit workflow handoff constraint and accepts a matching target', async () => {
    const handoff = step('final-group', {
      step_kind: 'workflow_handoff',
      selection_mode: 'explicit_workflow',
      target_workflow_id: null,
    });
    const commonResponses = () => ({
      group: [
        [
          { id: 'start-group', name: 'Start' },
          { id: 'final-group', name: 'Final' },
        ],
      ],
      group_connection: [[]],
      group_right_grant: [[]],
      group_membership_rule: [[]],
    });
    await expect(
      saveWorkflowDefinition(createTx(commonResponses()) as never, definition({ steps: [handoff] }))
    ).rejects.toThrow('require a target workflow');

    await expect(
      saveWorkflowDefinition(
        createTx({ ...commonResponses(), group_workflow: [null] }) as never,
        definition({ steps: [{ ...handoff, target_workflow_id: 'missing' }] })
      )
    ).rejects.toThrow('does not exist');

    await expect(
      saveWorkflowDefinition(
        createTx({
          ...commonResponses(),
          group_workflow: [{ id: 'wrong', group_id: 'other-group' }],
        }) as never,
        definition({ steps: [{ ...handoff, target_workflow_id: 'wrong' }] })
      )
    ).rejects.toThrow('must belong');

    const validTx = createTx({
      ...commonResponses(),
      group_workflow: [{ id: 'target', group_id: 'final-group' }, null],
      group_workflow_approval: [[]],
      group_workflow_step: [[]],
    });
    await saveWorkflowDefinition(
      validTx as never,
      definition({ steps: [{ ...handoff, target_workflow_id: 'target' }] })
    );
    expect(validTx.mutate.group_workflow.insert).toHaveBeenCalled();
  });

  it('deletes definitions and approves into active, pending, and rejected aggregate states', async () => {
    const deleteTx = createTx({
      group_workflow_approval: [[{ id: 'approval-1' }, { id: 'approval-2' }]],
      group_workflow_step: [[{ id: 'step-1' }]],
    });
    await deleteWorkflowDefinition(deleteTx as never, 'workflow-1');
    expect(deleteTx.mutate.group_workflow.delete).toHaveBeenCalledWith({ id: 'workflow-1' });

    for (const [statuses, expectedStatus] of [
      [['accepted', 'accepted'], 'active'],
      [['accepted', 'pending'], 'pending_approval'],
      [['accepted', 'rejected'], 'rejected'],
    ] as const) {
      const tx = createTx({
        group_workflow_approval: [
          { id: 'approval', workflow_id: 'workflow-1' },
          statuses.map((status, index) => ({ id: `status-${index}`, status })),
        ],
      });
      await approveWorkflowApproval(tx as never, 'approval');
      expect(tx.mutate.group_workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: expectedStatus })
      );
    }
  });

  it('throws for missing approvals and rejects a present approval and workflow', async () => {
    await expect(approveWorkflowApproval(createTx() as never, 'missing')).rejects.toThrow(
      'not found'
    );
    await expect(rejectWorkflowApproval(createTx() as never, 'missing')).rejects.toThrow(
      'not found'
    );

    const tx = createTx({
      group_workflow_approval: [{ id: 'approval', workflow_id: 'workflow-1' }],
    });
    await rejectWorkflowApproval(tx as never, 'approval');
    expect(tx.mutate.group_workflow_approval.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected' })
    );
    expect(tx.mutate.group_workflow.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected' })
    );
  });
});

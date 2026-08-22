import { beforeEach, describe, expect, it, vi } from 'vitest';

const denyPublicApiMutation = vi.hoisted(() => vi.fn());

vi.mock('../../rbac/authorize', () => ({ denyPublicApiMutation }));

import { amendmentSharedMutators } from '../shared-mutators';
import { DEFAULT_AMENDMENT_ROLES } from '../../rbac/constants';

interface Operation {
  table: string;
  action: string;
  value: unknown;
}

function createTx(runValues: unknown[] = []) {
  const operations: Operation[] = [];
  const tables = new Map<string, Record<string, (value: unknown) => Promise<void>>>();
  const mutate = new Proxy(
    {},
    {
      get: (_target, table: string) => {
        if (!tables.has(table)) {
          tables.set(
            table,
            new Proxy(
              {},
              {
                get: (_tableTarget, action: string) => async (value: unknown) => {
                  operations.push({ table, action, value });
                },
              }
            )
          );
        }
        return tables.get(table);
      },
    }
  );
  return {
    tx: {
      location: 'server',
      clientID: 'client-1',
      mutationID: 1,
      reason: 'test',
      run: vi.fn(async () => runValues.shift()),
      mutate,
    },
    operations,
  };
}

const ctx = { userID: 'user-1', email: 'user@example.com' };

beforeEach(() => {
  denyPublicApiMutation.mockClear();
  vi.spyOn(Date, 'now').mockReturnValue(1_000);
});

describe('amendment shared runtime defaults', () => {
  it('normalizes amendment origins and voting defaults without dropping explicit values', async () => {
    const first = createTx();
    await amendmentSharedMutators.create.fn({
      tx: first.tx as never,
      ctx,
      args: { id: 'one', clone_source_id: 'clone' } as never,
    });
    expect(first.operations[0].value).toEqual(
      expect.objectContaining({
        id: 'one',
        origin_amendment_id: 'clone',
        internal_cr_voting_close_trigger: 'all_collaborators_voted',
        internal_cr_voting_duration_minutes: null,
        current_process_run_id: null,
      })
    );

    const second = createTx();
    await amendmentSharedMutators.create.fn({
      tx: second.tx as never,
      ctx,
      args: {
        id: 'two',
        origin_amendment_id: 'origin',
        clone_source_id: 'clone',
        internal_cr_voting_close_trigger: 'after_minutes',
        internal_cr_voting_duration_minutes: 12,
        internal_cr_resolution_visibility: 'public',
        current_process_run_id: 'run-1',
      } as never,
    });
    expect(second.operations[0].value).toEqual(
      expect.objectContaining({
        origin_amendment_id: 'origin',
        internal_cr_voting_close_trigger: 'after_minutes',
        internal_cr_voting_duration_minutes: 12,
        internal_cr_resolution_visibility: 'public',
        current_process_run_id: 'run-1',
      })
    );

    const ownOrigin = createTx();
    await amendmentSharedMutators.create.fn({
      tx: ownOrigin.tx as never,
      ctx,
      args: { id: 'three' } as never,
    });
    expect(ownOrigin.operations[0].value).toHaveProperty('origin_amendment_id', 'three');
  });

  it('normalizes city-design optional values and strips branch authorization context', async () => {
    const empty = createTx();
    await amendmentSharedMutators.createCityDesign.fn({
      tx: empty.tx as never,
      ctx,
      args: { id: 'design-1', amendment_id: 'amendment-1', process_branch_id: 'branch-1' } as never,
    });
    expect(empty.operations[0].value).toEqual(
      expect.objectContaining({
        title: null,
        bbox: null,
        center_lat: null,
        center_lon: null,
        osm_snapshot: null,
        design_state: null,
        cost_catalog_version: null,
        cost_summary: null,
      })
    );
    expect(empty.operations[0].value).not.toHaveProperty('process_branch_id');

    const full = createTx();
    const values = {
      title: 'Design',
      bbox: 'bbox',
      center_lat: 1,
      center_lon: 2,
      osm_snapshot: 'snapshot',
      design_state: 'state',
      cost_catalog_version: 'v1',
      cost_summary: 'summary',
    };
    await amendmentSharedMutators.createCityDesign.fn({
      tx: full.tx as never,
      ctx,
      args: { id: 'design-2', amendment_id: 'amendment-1', ...values } as never,
    });
    expect(full.operations[0].value).toEqual(expect.objectContaining(values));
  });

  it('covers path, segment, and support-confirmation optional relationships', async () => {
    for (const process_run_id of [undefined, 'run-1']) {
      const state = createTx();
      await amendmentSharedMutators.createPath.fn({
        tx: state.tx as never,
        ctx,
        args: { id: `path-${process_run_id ?? 'none'}`, process_run_id } as never,
      });
      expect(state.operations[0].value).toHaveProperty('process_run_id', process_run_id ?? null);
    }

    for (const value of [undefined, 'linked']) {
      const state = createTx();
      await amendmentSharedMutators.createPathSegment.fn({
        tx: state.tx as never,
        ctx,
        args: {
          id: `segment-${value ?? 'none'}`,
          process_branch_id: value,
          process_step_run_id: value,
        } as never,
      });
      expect(state.operations[0].value).toEqual(
        expect.objectContaining({
          process_branch_id: value ?? null,
          process_step_run_id: value ?? null,
        })
      );
    }

    for (const value of [undefined, 'linked']) {
      const state = createTx();
      await amendmentSharedMutators.createSupportConfirmation.fn({
        tx: state.tx as never,
        ctx,
        args: {
          id: `confirmation-${value ?? 'none'}`,
          process_run_id: value,
          process_step_run_id: value,
          process_task_id: value,
        } as never,
      });
      expect(state.operations[0].value).toEqual(
        expect.objectContaining({
          process_run_id: value ?? null,
          process_step_run_id: value ?? null,
          process_task_id: value ?? null,
        })
      );
    }
  });

  it('updates or inserts group decisions with complete and defaulted runtime links', async () => {
    const existing = createTx([{ id: 'existing' }]);
    await amendmentSharedMutators.upsertGroupDecision.fn({
      tx: existing.tx as never,
      ctx,
      args: {
        id: 'ignored',
        amendment_id: 'amendment-1',
        group_id: 'group-1',
        process_run_id: 'run-1',
        process_branch_id: 'branch-1',
        process_step_run_id: 'step-1',
        status: 'accepted',
        decided_at: 500,
      } as never,
    });
    expect(existing.operations[0]).toEqual({
      table: 'amendment_group_decision',
      action: 'update',
      value: expect.objectContaining({
        id: 'existing',
        process_run_id: 'run-1',
        process_branch_id: 'branch-1',
        process_step_run_id: 'step-1',
        decided_at: 500,
      }),
    });

    const inserted = createTx([undefined]);
    await amendmentSharedMutators.upsertGroupDecision.fn({
      tx: inserted.tx as never,
      ctx,
      args: {
        id: 'new-id',
        amendment_id: 'amendment-1',
        group_id: 'group-1',
        status: 'pending',
      } as never,
    });
    expect(inserted.operations[0].value).toEqual(
      expect.objectContaining({
        id: 'new-id',
        process_run_id: null,
        process_branch_id: null,
        process_step_run_id: null,
        decided_at: 1_000,
      })
    );

    const existingDefaults = createTx([{ id: 'existing-defaults' }]);
    await amendmentSharedMutators.upsertGroupDecision.fn({
      tx: existingDefaults.tx as never,
      ctx,
      args: {
        amendment_id: 'amendment-1',
        group_id: 'group-2',
        status: 'pending',
      } as never,
    });
    expect(existingDefaults.operations[0].value).toEqual(
      expect.objectContaining({
        id: 'existing-defaults',
        process_run_id: null,
        process_branch_id: null,
        process_step_run_id: null,
        decided_at: 1_000,
      })
    );

    const generatedId = createTx([undefined]);
    const randomUUID = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('generated-id' as ReturnType<typeof crypto.randomUUID>);
    await amendmentSharedMutators.upsertGroupDecision.fn({
      tx: generatedId.tx as never,
      ctx,
      args: {
        amendment_id: 'amendment-1',
        group_id: 'group-3',
        status: 'pending',
      } as never,
    });
    expect(randomUUID).toHaveBeenCalledTimes(2);
    expect(generatedId.operations[0].value).toHaveProperty('id', 'generated-id');
  });

  it('normalizes every process-run relationship while preserving explicit values', async () => {
    const optionalKeys = [
      'root_workflow_id',
      'selected_source_group_id',
      'selected_target_group_id',
      'selected_target_workflow_id',
      'active_branch_id',
      'terminal_step_run_id',
      'evaluation_mode',
      'evaluation_date',
      'evaluation_offset_months',
      'evaluation_offset_years',
      'implementation_status',
    ];
    for (const explicit of [false, true]) {
      const state = createTx();
      const args = Object.fromEntries(
        optionalKeys.map(key => [key, explicit ? `${key}-value` : undefined])
      );
      await amendmentSharedMutators.createProcessRun.fn({
        tx: state.tx as never,
        ctx,
        args: { id: `run-${explicit}`, amendment_id: 'amendment-1', ...args } as never,
      });
      for (const key of optionalKeys) {
        expect(state.operations[0].value).toHaveProperty(key, explicit ? `${key}-value` : null);
      }
    }
  });

  it('derives process-branch editing mode and covers every optional branch value', async () => {
    const optionalKeys = [
      'parent_branch_id',
      'merged_into_branch_id',
      'source_step_run_id',
      'document_version_id',
      'document_id',
      'title',
      'resolution',
    ];
    const empty = createTx();
    await amendmentSharedMutators.createProcessBranch.fn({
      tx: empty.tx as never,
      ctx,
      args: { id: 'branch-empty', process_run_id: 'run-1' } as never,
    });
    expect(empty.operations[0].value).toEqual(
      expect.objectContaining({
        discussions: [],
        editing_mode: 'edit',
        parent_branch_id: null,
        document_id: null,
      })
    );

    const inherited = createTx([{ editing_mode: 'view' }]);
    await amendmentSharedMutators.createProcessBranch.fn({
      tx: inherited.tx as never,
      ctx,
      args: { id: 'branch-inherited', process_run_id: 'run-1', document_id: 'document-1' } as never,
    });
    expect(inherited.operations[0].value).toHaveProperty('editing_mode', 'view');

    const full = createTx();
    const values = Object.fromEntries(optionalKeys.map(key => [key, `${key}-value`]));
    await amendmentSharedMutators.createProcessBranch.fn({
      tx: full.tx as never,
      ctx,
      args: {
        id: 'branch-full',
        process_run_id: 'run-1',
        ...values,
        discussions: [{ id: 'discussion-1' }],
        editing_mode: 'suggest_internal',
      } as never,
    });
    expect(full.tx.run).toHaveBeenCalledOnce();
    expect(full.operations[0].value).toEqual(
      expect.objectContaining({
        ...values,
        discussions: [{ id: 'discussion-1' }],
        editing_mode: 'suggest_internal',
      })
    );
  });

  it('normalizes all process-step relationships and timestamps', async () => {
    const optionalKeys = [
      'workflow_id',
      'workflow_step_id',
      'selection_mode',
      'merge_strategy',
      'source_group_id',
      'target_group_id',
      'event_id',
      'agenda_item_id',
      'vote_id',
      'support_confirmation_id',
      'decision_status',
      'starts_at',
      'ends_at',
    ];
    for (const explicit of [false, true]) {
      const state = createTx();
      const values = Object.fromEntries(
        optionalKeys.map(key => [key, explicit ? `${key}-value` : undefined])
      );
      await amendmentSharedMutators.createProcessStepRun.fn({
        tx: state.tx as never,
        ctx,
        args: {
          id: `step-${explicit}`,
          process_run_id: 'run-1',
          order_index: 0,
          ...values,
        } as never,
      });
      for (const key of optionalKeys) {
        expect(state.operations[0].value).toHaveProperty(key, explicit ? `${key}-value` : null);
      }
    }
  });

  it('normalizes all process-task relationships and metadata', async () => {
    const optionalKeys = [
      'branch_id',
      'step_run_id',
      'title',
      'description',
      'group_id',
      'target_group_id',
      'event_id',
      'agenda_item_id',
      'support_confirmation_id',
      'due_at',
      'resolved_at',
      'metadata',
    ];
    for (const explicit of [false, true]) {
      const state = createTx();
      const values = Object.fromEntries(
        optionalKeys.map(key => [key, explicit ? `${key}-value` : undefined])
      );
      await amendmentSharedMutators.createProcessTask.fn({
        tx: state.tx as never,
        ctx,
        args: {
          id: `task-${explicit}`,
          process_run_id: 'run-1',
          task_type: 'schedule_event',
          status: 'open',
          ...values,
        } as never,
      });
      for (const key of optionalKeys) {
        expect(state.operations[0].value).toHaveProperty(key, explicit ? `${key}-value` : null);
      }
    }
  });

  it('records collaborator, path, and support-confirmation activity with no-op fallbacks', async () => {
    const collaboratorAdded = createTx();
    await amendmentSharedMutators.addCollaborator.fn({
      tx: collaboratorAdded.tx as never,
      ctx,
      args: {
        amendment_id: 'amendment-1',
        id: 'collaborator-added',
        user_id: 'user-4',
      } as never,
    });

    for (const collaborator of [
      {
        amendment_id: 'amendment-1',
        id: 'collaborator-full',
        role_id: 'role-1',
        status: 'active',
        user_id: 'user-2',
      },
      {
        amendment_id: 'amendment-1',
        id: 'collaborator-null',
        role_id: null,
        status: null,
        user_id: 'user-3',
      },
    ]) {
      const state = createTx([collaborator]);
      await amendmentSharedMutators.removeCollaborator.fn({
        tx: state.tx as never,
        ctx,
        args: { id: collaborator.id },
      });
      expect(state.operations.some(operation => operation.table === 'amendment_activity')).toBe(
        true
      );
    }

    const path = createTx([{ amendment_id: 'amendment-1', id: 'path-1', title: null }]);
    await amendmentSharedMutators.deletePath.fn({
      tx: path.tx as never,
      ctx,
      args: { id: 'path-1' },
    });

    const segmentCreated = createTx([{ amendment_id: 'amendment-1', id: 'path-1' }]);
    await amendmentSharedMutators.createPathSegment.fn({
      tx: segmentCreated.tx as never,
      ctx,
      args: {
        event_id: null,
        group_id: 'group-1',
        id: 'segment-1',
        path_id: 'path-1',
      } as never,
    });

    const clientSegment = createTx();
    (clientSegment.tx as any).location = 'client';
    await amendmentSharedMutators.createPathSegment.fn({
      tx: clientSegment.tx as never,
      ctx,
      args: { id: 'client-segment', path_id: 'path-1' } as never,
    });

    const segmentDeleted = createTx([
      { event_id: null, group_id: 'group-1', id: 'segment-1', path_id: 'path-1' },
      { amendment_id: 'amendment-1', id: 'path-1' },
    ]);
    await amendmentSharedMutators.deletePathSegment.fn({
      tx: segmentDeleted.tx as never,
      ctx,
      args: { id: 'segment-1' },
    });

    for (const previous of [
      null,
      {
        amendment_id: 'amendment-1',
        confirmed_by_id: 'user-2',
        id: 'confirmation-1',
        status: 'pending',
      },
      {
        amendment_id: 'amendment-1',
        confirmed_by_id: 'user-2',
        id: 'confirmation-1',
        status: 'confirmed',
      },
    ]) {
      const state = createTx([previous]);
      await amendmentSharedMutators.updateSupportConfirmation.fn({
        tx: state.tx as never,
        ctx,
        args: { id: 'confirmation-1', status: 'confirmed' } as never,
      });
    }
  });

  it('records process runtime creation, updates, and deletion activity', async () => {
    const processRunUpdate = createTx([
      { amendment_id: 'amendment-1', id: 'run-1', implementation_status: 'pending' },
    ]);
    await amendmentSharedMutators.updateProcessRun.fn({
      tx: processRunUpdate.tx as never,
      ctx,
      args: { id: 'run-1', implementation_status: 'implemented' } as never,
    });

    const processRunStatusUpdate = createTx([
      { amendment_id: 'amendment-1', id: 'run-1', status: 'active' },
    ]);
    await amendmentSharedMutators.updateProcessRun.fn({
      tx: processRunStatusUpdate.tx as never,
      ctx,
      args: { id: 'run-1', status: 'completed' } as never,
    });

    const processRunNoop = createTx([
      { amendment_id: 'amendment-1', id: 'run-1', status: 'active' },
    ]);
    await amendmentSharedMutators.updateProcessRun.fn({
      tx: processRunNoop.tx as never,
      ctx,
      args: { id: 'run-1', status: 'active' } as never,
    });

    const processRunDelete = createTx([{ amendment_id: 'amendment-1', id: 'run-1' }]);
    await amendmentSharedMutators.deleteProcessRun.fn({
      tx: processRunDelete.tx as never,
      ctx,
      args: { id: 'run-1' },
    });

    const branchCreate = createTx([{ amendment_id: 'amendment-1', id: 'run-1' }]);
    await amendmentSharedMutators.createProcessBranch.fn({
      tx: branchCreate.tx as never,
      ctx,
      args: { id: 'branch-1', process_run_id: 'run-1', status: 'active' } as never,
    });

    const clientBranch = createTx();
    (clientBranch.tx as any).location = 'client';
    await amendmentSharedMutators.createProcessBranch.fn({
      tx: clientBranch.tx as never,
      ctx,
      args: { id: 'client-branch', process_run_id: 'run-1', status: 'active' } as never,
    });

    const branchUpdate = createTx([
      { discussions: [], id: 'branch-1', process_run_id: 'run-1', title: 'Old' },
      { amendment_id: 'amendment-1', id: 'run-1' },
    ]);
    await amendmentSharedMutators.updateProcessBranch.fn({
      tx: branchUpdate.tx as never,
      ctx,
      args: { discussions: [], id: 'branch-1', title: 'New' } as never,
    });

    const branchDelete = createTx([
      { id: 'branch-1', process_run_id: 'run-1', title: null },
      { amendment_id: 'amendment-1', id: 'run-1' },
    ]);
    await amendmentSharedMutators.deleteProcessBranch.fn({
      tx: branchDelete.tx as never,
      ctx,
      args: { id: 'branch-1' },
    });

    const stepCreate = createTx([{ amendment_id: 'amendment-1', id: 'run-1' }]);
    await amendmentSharedMutators.createProcessStepRun.fn({
      tx: stepCreate.tx as never,
      ctx,
      args: { id: 'step-1', process_run_id: 'run-1', status: 'active' } as never,
    });

    const stepUpdate = createTx([
      { id: 'step-1', process_run_id: 'run-1', status: 'active' },
      { amendment_id: 'amendment-1', id: 'run-1' },
    ]);
    await amendmentSharedMutators.updateProcessStepRun.fn({
      tx: stepUpdate.tx as never,
      ctx,
      args: { id: 'step-1', status: 'completed' } as never,
    });

    const stepDelete = createTx([
      { id: 'step-1', process_run_id: 'run-1' },
      { amendment_id: 'amendment-1', id: 'run-1' },
    ]);
    await amendmentSharedMutators.deleteProcessStepRun.fn({
      tx: stepDelete.tx as never,
      ctx,
      args: { id: 'step-1' },
    });

    const taskCreate = createTx([{ amendment_id: 'amendment-1', id: 'run-1' }]);
    await amendmentSharedMutators.createProcessTask.fn({
      tx: taskCreate.tx as never,
      ctx,
      args: {
        id: 'task-1',
        process_run_id: 'run-1',
        status: 'open',
        task_type: 'schedule_event',
      } as never,
    });

    const taskUpdate = createTx([
      { id: 'task-1', process_run_id: 'run-1', status: 'open', task_type: 'schedule_event' },
      { amendment_id: 'amendment-1', id: 'run-1' },
    ]);
    await amendmentSharedMutators.updateProcessTask.fn({
      tx: taskUpdate.tx as never,
      ctx,
      args: { id: 'task-1', status: 'completed' } as never,
    });

    const taskDelete = createTx([
      { id: 'task-1', process_run_id: 'run-1', task_type: 'schedule_event', title: null },
      { amendment_id: 'amendment-1', id: 'run-1' },
    ]);
    await amendmentSharedMutators.deleteProcessTask.fn({
      tx: taskDelete.tx as never,
      ctx,
      args: { id: 'task-1' },
    });
  });

  it('records collaborator and change-request updates for normal and terminal fields', async () => {
    const collaborator = createTx([
      {
        amendment_id: 'amendment-1',
        id: 'collaborator-1',
        role_id: 'role-1',
        status: 'active',
        user_id: 'user-2',
        visibility: 'private',
      },
    ]);
    await amendmentSharedMutators.updateCollaborator.fn({
      tx: collaborator.tx as never,
      ctx,
      args: { id: 'collaborator-1', status: 'member' } as never,
    });

    for (const args of [
      { description: 'Updated', id: 'change-request-normal' },
      { id: 'change-request-terminal', status: 'approved' },
    ]) {
      const state = createTx([
        {
          amendment_id: 'amendment-1',
          description: 'Old',
          id: args.id,
          status: 'open',
          title: null,
        },
      ]);
      await amendmentSharedMutators.updateChangeRequest.fn({
        tx: state.tx as never,
        ctx,
        args: args as never,
      });
      expect(state.operations.some(operation => operation.table === 'amendment_activity')).toBe(
        true
      );
    }
  });

  it('skips activity for missing and unchanged update records', async () => {
    const changed = createTx([{ id: 'amendment-1', title: 'Old' }]);
    await amendmentSharedMutators.update.fn({
      tx: changed.tx as never,
      ctx,
      args: { id: 'amendment-1', title: 'New' } as never,
    });

    for (const previous of [null, { id: 'amendment-1', title: 'Same' }]) {
      const state = createTx([previous]);
      await amendmentSharedMutators.update.fn({
        tx: state.tx as never,
        ctx,
        args: { id: 'amendment-1', title: 'Same' } as never,
      });
    }

    const cases = [
      {
        mutator: amendmentSharedMutators.updateProcessBranch,
        previous: { discussions: [], id: 'record-1', process_run_id: 'run-1', title: 'Same' },
        args: { discussions: [], id: 'record-1', title: 'Same' },
      },
      {
        mutator: amendmentSharedMutators.updateProcessStepRun,
        previous: { id: 'record-1', process_run_id: 'run-1', status: 'active' },
        args: { id: 'record-1', status: 'active' },
      },
      {
        mutator: amendmentSharedMutators.updateProcessTask,
        previous: {
          id: 'record-1',
          process_run_id: 'run-1',
          status: 'open',
          task_type: 'schedule_event',
        },
        args: { id: 'record-1', status: 'open' },
      },
      {
        mutator: amendmentSharedMutators.updateCollaborator,
        previous: {
          amendment_id: 'amendment-1',
          id: 'record-1',
          status: 'active',
          user_id: 'user-2',
        },
        args: { id: 'record-1', status: 'active' },
      },
      {
        mutator: amendmentSharedMutators.updateChangeRequest,
        previous: {
          amendment_id: 'amendment-1',
          description: 'Same',
          id: 'record-1',
          status: 'open',
        },
        args: { description: 'Same', id: 'record-1' },
      },
    ];
    for (const testCase of cases) {
      const state = createTx([testCase.previous, { amendment_id: 'amendment-1', id: 'run-1' }]);
      await testCase.mutator.fn({
        tx: state.tx as never,
        ctx,
        args: testCase.args as never,
      });
    }
  });

  it('fails creator bootstrap when the canonical Author role is absent', async () => {
    const roles = DEFAULT_AMENDMENT_ROLES as unknown as any[];
    const authorIndex = roles.findIndex(role => role.name === 'Author');
    const [author] = roles.splice(authorIndex, 1);
    try {
      const state = createTx();
      await expect(
        amendmentSharedMutators.create.fn({
          tx: state.tx as never,
          ctx,
          args: { id: 'without-author' } as never,
        })
      ).rejects.toThrow('Default Author role is missing');
    } finally {
      roles.splice(authorIndex, 0, author);
    }
  });
});

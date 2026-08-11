import type { Transaction } from '@rocicorp/zero';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { Schema } from '../schema';
import { zql } from '../schema';
import { fireProcessTaskCreatedNotification } from './process-task-notification';

type ZeroTransaction = Transaction<Schema>;

export async function createScheduleEventTask(
  tx: ZeroTransaction,
  args: {
    processRunId: string;
    branchId: string;
    stepRunId: string;
    taskTitle: string;
    taskDescription: string;
    groupId: string;
    targetGroupId: string | null;
    metadata: Record<string, unknown>;
    senderId?: string | null;
    groupName?: string | null;
  }
) {
  const now = Date.now();
  const existingTask = await tx.run(
    zql.process_task.where('step_run_id', args.stepRunId).where('task_type', 'schedule_event').one()
  );
  const reusableTask = Array.isArray(existingTask) ? null : existingTask;

  if (reusableTask && reusableTask.status !== 'completed' && reusableTask.status !== 'cancelled') {
    return reusableTask.id;
  }

  const id = crypto.randomUUID();
  await tx.mutate.process_task.insert({
    id,
    process_run_id: args.processRunId,
    branch_id: args.branchId,
    step_run_id: args.stepRunId,
    task_type: 'schedule_event',
    status: 'open',
    title: args.taskTitle,
    description: args.taskDescription,
    group_id: args.groupId,
    target_group_id: args.targetGroupId,
    event_id: null,
    agenda_item_id: null,
    support_confirmation_id: null,
    due_at: null,
    resolved_at: null,
    metadata: args.metadata as never,
    created_at: now,
    updated_at: now,
  });
  fireProcessTaskCreatedNotification({
    senderId: args.senderId,
    groupId: args.groupId,
    groupName: args.groupName,
    taskTitle: args.taskTitle,
  });
  return id;
}

export async function createImplementationEvaluationTask(
  tx: ZeroTransaction,
  args: {
    processRunId: string;
    amendmentId: string;
    amendmentTitle: string;
    targetGroupId: string;
    targetGroupName: string;
    dueAt: number;
    requiredAfter: number;
    evaluationMode: 'fixed_date' | 'relative_to_vote';
    senderId?: string | null;
  }
) {
  const existingTasks = await tx.run(
    zql.process_task
      .where('process_run_id', args.processRunId)
      .where('task_type', 'implementation_evaluation')
      .orderBy('created_at', 'asc')
  );

  const reusableTask =
    existingTasks.find(task => task.status !== 'cancelled') ??
    existingTasks.find(task => task.status === 'cancelled') ??
    null;

  if (reusableTask) {
    if (reusableTask.status !== 'cancelled') {
      return reusableTask.id;
    }

    const taskTitle = translateText(
      'generated.inline.0682_umsetzung_evaluieren_amendmenttitle_7226ff50',
      {
        amendmentTitle: args.amendmentTitle,
      }
    );
    const taskDescription = translateText(
      'generated.inline.0683_plane_die_umsetzungspruefung_fuer_amendmentti_14e50868',
      { amendmentTitle: args.amendmentTitle, targetGroupName: args.targetGroupName }
    );

    await tx.mutate.process_task.update({
      id: reusableTask.id,
      status: 'open',
      title: taskTitle,
      description: taskDescription,
      group_id: args.targetGroupId,
      target_group_id: args.targetGroupId,
      event_id: null,
      agenda_item_id: null,
      support_confirmation_id: null,
      due_at: args.dueAt,
      resolved_at: null,
      metadata: {
        amendmentId: args.amendmentId,
        amendmentTitle: args.amendmentTitle,
        groupName: args.targetGroupName,
        requiredAfter: args.requiredAfter,
        requiredBefore: args.dueAt,
        targetGroupId: args.targetGroupId,
        evaluationMode: args.evaluationMode,
        evaluationDueAt: args.dueAt,
      } as never,
      updated_at: Date.now(),
    });
    fireProcessTaskCreatedNotification({
      senderId: args.senderId,
      groupId: args.targetGroupId,
      groupName: args.targetGroupName,
      taskTitle,
    });

    return reusableTask.id;
  }

  const now = Date.now();
  const taskId = crypto.randomUUID();
  const taskTitle = translateText(
    'generated.inline.0682_umsetzung_evaluieren_amendmenttitle_7226ff50',
    {
      amendmentTitle: args.amendmentTitle,
    }
  );
  const taskDescription = translateText(
    'generated.inline.0683_plane_die_umsetzungspruefung_fuer_amendmentti_14e50868',
    { amendmentTitle: args.amendmentTitle, targetGroupName: args.targetGroupName }
  );
  await tx.mutate.process_task.insert({
    id: taskId,
    process_run_id: args.processRunId,
    branch_id: null,
    step_run_id: null,
    task_type: 'implementation_evaluation',
    status: 'open',
    title: taskTitle,
    description: taskDescription,
    group_id: args.targetGroupId,
    target_group_id: args.targetGroupId,
    event_id: null,
    agenda_item_id: null,
    support_confirmation_id: null,
    due_at: args.dueAt,
    resolved_at: null,
    metadata: {
      amendmentId: args.amendmentId,
      amendmentTitle: args.amendmentTitle,
      groupName: args.targetGroupName,
      requiredAfter: args.requiredAfter,
      requiredBefore: args.dueAt,
      targetGroupId: args.targetGroupId,
      evaluationMode: args.evaluationMode,
      evaluationDueAt: args.dueAt,
    } as never,
    created_at: now,
    updated_at: now,
  });
  fireProcessTaskCreatedNotification({
    senderId: args.senderId,
    groupId: args.targetGroupId,
    groupName: args.targetGroupName,
    taskTitle,
  });

  return taskId;
}

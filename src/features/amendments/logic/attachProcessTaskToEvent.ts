import { createDefaultDecisionVoteChoices } from '@/features/votes/logic/createDefaultVoteChoices';

interface TaskLike {
  id: string;
  task_type?: string | null;
  process_run_id: string;
  step_run_id?: string | null;
  support_confirmation_id?: string | null;
  process_run?: {
    amendment?: {
      id?: string | null;
      title?: string | null;
    } | null;
  } | null;
  support_confirmation?: {
    amendment?: {
      id?: string | null;
      title?: string | null;
    } | null;
  } | null;
}

interface EventLike {
  id: string;
  title?: string | null;
  start_date?: number | null;
}

interface AttachProcessTaskToEventActions {
  createAgendaItem: (args: {
    id: string;
    title: string;
    description: string;
    type: string;
    status: string;
    forwarding_status: string;
    order_index: number;
    duration: number;
    scheduled_time: string;
    start_time: number;
    end_time: number;
    activated_at: number;
    completed_at: number;
    event_id: string;
    amendment_id: string | null;
    majority_type: null;
    time_limit: null;
    voting_phase: null;
  }) => Promise<unknown>;
  createVote: (args: {
    id: string;
    agenda_item_id: string;
    amendment_id: string | null;
    title: string;
    description: string;
    closing_duration_seconds: null;
    closing_end_time: null;
  }) => Promise<unknown>;
  createVoteChoice: (args: {
    id: string;
    vote_id: string;
    label: string | null;
    order_index: number | null;
  }) => Promise<unknown>;
  updateProcessTask: (args: {
    id: string;
    status: 'completed';
    event_id: string;
    agenda_item_id: string;
    resolved_at: number;
  }) => Promise<unknown>;
  updateProcessStepRun: (args: {
    id: string;
    event_id: string;
    agenda_item_id: string;
    vote_id: string | null;
    starts_at: number | null;
    status: 'scheduled';
  }) => Promise<unknown>;
  updateProcessRun: (args: {
    id: string;
    implementation_status: 'evaluation_scheduled';
  }) => Promise<unknown>;
  updateSupportConfirmation: (args: {
    id: string;
    event_id: string;
    process_task_id: string;
  }) => Promise<unknown>;
}

interface AttachProcessTaskToEventArgs extends AttachProcessTaskToEventActions {
  task: TaskLike;
  event: EventLike;
  description: string;
}

export async function attachProcessTaskToEvent({
  task,
  event,
  description,
  createAgendaItem,
  createVote,
  createVoteChoice,
  updateProcessTask,
  updateProcessStepRun,
  updateProcessRun,
  updateSupportConfirmation,
}: AttachProcessTaskToEventArgs) {
  const amendmentId =
    task.process_run?.amendment?.id ?? task.support_confirmation?.amendment?.id ?? null;
  const amendmentTitle =
    task.process_run?.amendment?.title ?? task.support_confirmation?.amendment?.title ?? null;
  const agendaItemId = crypto.randomUUID();
  const voteId = task.task_type === 'support_confirmation' ? null : crypto.randomUUID();
  const agendaType =
    task.task_type === 'implementation_evaluation'
      ? 'implementation_review'
      : task.task_type === 'support_confirmation'
        ? 'support_confirmation'
        : 'amendment';
  const agendaTitle =
    task.task_type === 'implementation_evaluation'
      ? `Umsetzungspruefung: ${amendmentTitle ?? 'Aenderungsantrag'}`
      : task.task_type === 'support_confirmation'
        ? `Unterstuetzung bestaetigen: ${amendmentTitle ?? 'Aenderungsantrag'}`
        : `Amendment: ${amendmentTitle ?? event.title ?? 'Aenderungsantrag'}`;

  await createAgendaItem({
    id: agendaItemId,
    title: agendaTitle,
    description,
    type: agendaType,
    status: 'pending',
    forwarding_status: '',
    order_index: Date.now(),
    duration: 0,
    scheduled_time: '',
    start_time: 0,
    end_time: 0,
    activated_at: 0,
    completed_at: 0,
    event_id: event.id,
    amendment_id: amendmentId,
    majority_type: null,
    time_limit: null,
    voting_phase: null,
  });

  if (voteId) {
    await createVote({
      id: voteId,
      agenda_item_id: agendaItemId,
      amendment_id: amendmentId,
      title: agendaTitle,
      description,
      closing_duration_seconds: null,
      closing_end_time: null,
    });

    await createDefaultDecisionVoteChoices(createVoteChoice, voteId);
  }

  await updateProcessTask({
    id: task.id,
    status: 'completed',
    event_id: event.id,
    agenda_item_id: agendaItemId,
    resolved_at: Date.now(),
  });

  if (task.step_run_id) {
    await updateProcessStepRun({
      id: task.step_run_id,
      event_id: event.id,
      agenda_item_id: agendaItemId,
      vote_id: voteId,
      starts_at: event.start_date ?? null,
      status: 'scheduled',
    });
  }

  if (task.task_type === 'implementation_evaluation') {
    await updateProcessRun({
      id: task.process_run_id,
      implementation_status: 'evaluation_scheduled',
    });
  }

  if (task.support_confirmation_id) {
    await updateSupportConfirmation({
      id: task.support_confirmation_id,
      event_id: event.id,
      process_task_id: task.id,
    });
  }

  return {
    agendaItemId,
    voteId,
  };
}

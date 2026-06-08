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
  completeProcessTaskWithEvent: (args: {
    process_task_id: string;
    event_id: string;
    description?: string | null;
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
  completeProcessTaskWithEvent,
}: AttachProcessTaskToEventArgs) {
  return completeProcessTaskWithEvent({
    process_task_id: task.id,
    event_id: event.id,
    description,
  });
}

export type AgendaRuntimeStatus = 'completed' | 'in-progress' | 'pending' | 'planned';

interface AgendaRuntimeStatusInput {
  id: string;
  status?: string | null;
  start_time?: number | null;
  end_time?: number | null;
  activated_at?: number | null;
  completed_at?: number | null;
  currentAgendaItemId?: string | null;
}

function hasTimestamp(value: number | null | undefined) {
  return typeof value === 'number' && value > 0;
}

export function getAgendaRuntimeStatus(input: AgendaRuntimeStatusInput): AgendaRuntimeStatus {
  const isCurrent = input.currentAgendaItemId === input.id;
  const isCompleted =
    input.status === 'completed' ||
    hasTimestamp(input.completed_at) ||
    hasTimestamp(input.end_time);

  if (isCompleted) {
    return 'completed';
  }

  const isOngoing =
    isCurrent ||
    input.status === 'in-progress' ||
    input.status === 'active' ||
    hasTimestamp(input.activated_at) ||
    hasTimestamp(input.start_time);

  if (isOngoing) {
    return 'in-progress';
  }

  if (input.status === 'planned') {
    return 'planned';
  }

  return 'pending';
}

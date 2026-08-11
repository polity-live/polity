import {
  formatLocalDateInput,
  formatLocalTimeInput,
  toLocalEndOfDayTimestamp,
  toLocalTimestamp,
} from '@/features/shared/logic/localDateTime';
import type { CreateEventSearch } from '@/features/create/logic/createEventSearch';
import { translate } from '@/features/shared/hooks/use-translation';

export interface ProcessTaskScheduleMetadata {
  amendmentId?: string;
  amendmentTitle?: string;
  requiredAfter?: number | null;
  requiredBefore?: number | null;
  sourceGroupId?: string | null;
  targetGroupId?: string | null;
  pathMode?: 'hierarchy' | 'workflow' | null;
  workflowId?: string | null;
  evaluationMode?: 'fixed_date' | 'relative_to_vote' | null;
  evaluationDueAt?: number | null;
  returnTo?: string | null;
}

export interface ProcessTaskScheduleLike {
  id: string;
  task_type?: string | null;
  group_id?: string | null;
  process_run_id?: string | null;
  step_run_id?: string | null;
  due_at?: number | null;
  metadata?: unknown;
}

export interface EventSchedulingWindow {
  minStartAt: number | null;
  maxStartAt: number | null;
}

function formatSchedulingBoundary(date?: string | null, time?: string | null) {
  if (!date) {
    return null;
  }

  return time ? `${date} ${time}` : date;
}

export function getSchedulingWindowDisplayLabel(args: {
  minStartDate?: string | null;
  minStartTime?: string | null;
  maxStartDate?: string | null;
  maxStartTime?: string | null;
}) {
  const minLabel = formatSchedulingBoundary(args.minStartDate, args.minStartTime);
  const maxLabel = formatSchedulingBoundary(args.maxStartDate, args.maxStartTime);

  if (minLabel && maxLabel) {
    return translate('features.amendments.processTaskScheduling.range', {
      min: minLabel,
      max: maxLabel,
    });
  }

  if (minLabel) {
    return translate('features.amendments.processTaskScheduling.earliest', { min: minLabel });
  }

  if (maxLabel) {
    return translate('features.amendments.processTaskScheduling.latest', { max: maxLabel });
  }

  return null;
}

export function parseProcessTaskScheduleMetadata(
  metadata: unknown
): ProcessTaskScheduleMetadata | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const candidate = metadata as Record<string, unknown>;
  const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null);
  const stringOrNull = (value: unknown) => (typeof value === 'string' ? value : null);

  const pathModeValue = candidate.pathMode;
  const pathMode =
    pathModeValue === 'hierarchy' || pathModeValue === 'workflow' ? pathModeValue : null;

  const evaluationModeValue = candidate.evaluationMode;
  const evaluationMode =
    evaluationModeValue === 'fixed_date' || evaluationModeValue === 'relative_to_vote'
      ? evaluationModeValue
      : null;

  return {
    amendmentId: stringOrNull(candidate.amendmentId) ?? undefined,
    amendmentTitle: stringOrNull(candidate.amendmentTitle) ?? undefined,
    requiredAfter: numberOrNull(candidate.requiredAfter),
    requiredBefore: numberOrNull(candidate.requiredBefore),
    sourceGroupId: stringOrNull(candidate.sourceGroupId),
    targetGroupId: stringOrNull(candidate.targetGroupId),
    pathMode,
    workflowId: stringOrNull(candidate.workflowId),
    evaluationMode,
    evaluationDueAt: numberOrNull(candidate.evaluationDueAt),
    returnTo: stringOrNull(candidate.returnTo),
  };
}

export function getProcessTaskSchedulingWindow(
  task: Pick<ProcessTaskScheduleLike, 'due_at' | 'metadata'>
): EventSchedulingWindow {
  const metadata = parseProcessTaskScheduleMetadata(task.metadata);
  return {
    minStartAt: metadata?.requiredAfter ?? null,
    maxStartAt: metadata?.requiredBefore ?? task.due_at ?? null,
  };
}

export function isEventWithinSchedulingWindow(
  event: Pick<{ start_date?: number | null }, 'start_date'>,
  window: EventSchedulingWindow
) {
  const startDate = event.start_date ?? null;
  if (startDate == null) {
    return false;
  }
  if (window.minStartAt != null && startDate < window.minStartAt) {
    return false;
  }
  if (window.maxStartAt != null && startDate > window.maxStartAt) {
    return false;
  }
  return true;
}

export function getSchedulingWindowValidationMessage(args: {
  startDate?: string | null;
  startTime?: string | null;
  minStartDate?: string | null;
  minStartTime?: string | null;
  maxStartDate?: string | null;
  maxStartTime?: string | null;
}) {
  const eventStartAt = toLocalTimestamp(args.startDate, args.startTime);
  if (eventStartAt == null) {
    return null;
  }

  const windowLabel = getSchedulingWindowDisplayLabel(args);

  const minStartAt = toLocalTimestamp(args.minStartDate, args.minStartTime);
  if (minStartAt != null && eventStartAt < minStartAt) {
    return windowLabel as string;
  }

  const maxStartAt =
    toLocalTimestamp(args.maxStartDate, args.maxStartTime) ??
    toLocalEndOfDayTimestamp(args.maxStartDate);
  if (maxStartAt != null && eventStartAt > maxStartAt) {
    return windowLabel as string;
  }

  return null;
}

export function buildCreateEventSearchFromProcessTask(args: {
  task: ProcessTaskScheduleLike;
  groupId: string;
  returnTo?: string | null;
}): CreateEventSearch {
  const metadata = parseProcessTaskScheduleMetadata(args.task.metadata);
  const window = getProcessTaskSchedulingWindow(args.task);
  const minStartDate = formatLocalDateInput(window.minStartAt);
  const minStartTime = formatLocalTimeInput(window.minStartAt);
  const maxStartDate = formatLocalDateInput(window.maxStartAt);
  const maxStartTime = formatLocalTimeInput(window.maxStartAt);

  return {
    groupId: args.groupId,
    processTaskId: args.task.id,
    processRunId: args.task.process_run_id ?? undefined,
    stepRunId: args.task.step_run_id ?? undefined,
    amendmentId: metadata?.amendmentId ?? undefined,
    minStartDate: minStartDate || undefined,
    minStartTime: minStartTime || undefined,
    maxStartDate: maxStartDate || undefined,
    maxStartTime: maxStartTime || undefined,
    returnTo: args.returnTo ?? metadata?.returnTo ?? undefined,
  };
}

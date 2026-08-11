import type { CreateEventSearch } from '@/features/create/logic/createEventSearch';
import { formatLocalDateInput, formatLocalTimeInput } from '@/features/shared/logic/localDateTime';
import type { GroupOpenAssignment } from './openAssignments';

export interface DelegateElectionSchedulingWindow {
  minStartAt: number;
  maxStartAt: number | null;
}

interface EventStartLike {
  start_date?: number | null;
}

function toNextInputMinute(timestamp: number) {
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  return date.getTime() + 60_000;
}

function getTargetStartAt(assignment: Pick<GroupOpenAssignment, 'targetEvent'>) {
  const startDate = assignment.targetEvent?.start_date;
  return typeof startDate === 'number' && Number.isFinite(startDate) && startDate > 0
    ? startDate
    : null;
}

export function getDelegateElectionSchedulingWindow(
  assignment: Pick<GroupOpenAssignment, 'targetEvent'>,
  referenceTime: number = Date.now()
): DelegateElectionSchedulingWindow {
  const targetStartAt = getTargetStartAt(assignment);

  return {
    minStartAt: toNextInputMinute(referenceTime),
    maxStartAt: targetStartAt == null ? null : targetStartAt - 1,
  };
}

export function isEventWithinDelegateElectionSchedulingWindow(
  event: EventStartLike,
  assignment: Pick<GroupOpenAssignment, 'targetEvent'>,
  referenceTime: number = Date.now()
) {
  const startDate = event.start_date ?? null;
  if (startDate == null) {
    return false;
  }

  const window = getDelegateElectionSchedulingWindow(assignment, referenceTime);
  if (startDate < window.minStartAt) {
    return false;
  }

  if (window.maxStartAt != null && startDate > window.maxStartAt) {
    return false;
  }

  return true;
}

export function buildCreateEventSearchFromDelegateElectionAssignment(args: {
  assignment: Pick<GroupOpenAssignment, 'targetEvent'>;
  groupId: string;
  returnTo?: string | null;
  referenceTime?: number;
}): CreateEventSearch {
  const window = getDelegateElectionSchedulingWindow(args.assignment, args.referenceTime);
  const maxStartDate = window.maxStartAt == null ? '' : formatLocalDateInput(window.maxStartAt);
  const maxStartTime = window.maxStartAt == null ? '' : formatLocalTimeInput(window.maxStartAt);

  return {
    groupId: args.groupId,
    minStartDate: formatLocalDateInput(window.minStartAt),
    minStartTime: formatLocalTimeInput(window.minStartAt),
    maxStartDate: maxStartDate || undefined,
    maxStartTime: maxStartTime || undefined,
    returnTo: args.returnTo ?? undefined,
  };
}

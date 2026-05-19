type TermDuration = 'monthly' | 'quarterly' | 'yearly' | 'biannual';

interface ScheduleRevoteParams {
  roleId: string;
  groupId: string;
  termDuration: TermDuration;
  termStartDate: Date;
  userId: string;
}

interface RoleRevoteLike {
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  term_start_date?: number | null;
  scheduled_revote_date?: number | null;
}

export interface RoleRevoteStatus {
  dueDate: number | null;
  isOverdue: boolean;
  label: string;
}

export function computeRoleScheduledRevoteDate(args: {
  termStartDate: number | Date | null | undefined;
  recurrencePattern?: string | null;
  recurrenceInterval?: number | null;
}) {
  const normalizedStart =
    args.termStartDate instanceof Date
      ? args.termStartDate.getTime()
      : (args.termStartDate ?? null);

  if (!normalizedStart) return null;

  const interval = Math.max(1, args.recurrenceInterval ?? 1);

  switch (args.recurrencePattern) {
    case 'yearly':
      return addYears(normalizedStart, interval);
    case 'four-yearly':
      return addYears(normalizedStart, interval * 4);
    default:
      return null;
  }
}

export function getRoleRevoteStatus(
  role: RoleRevoteLike,
  referenceTime: number = Date.now()
): RoleRevoteStatus {
  const scheduledRevote = role.scheduled_revote_date ?? null;

  if (scheduledRevote) {
    return {
      dueDate: scheduledRevote,
      isOverdue: scheduledRevote <= referenceTime,
      label:
        scheduledRevote <= referenceTime
          ? `Overdue since ${formatDate(scheduledRevote)}`
          : `Next revote ${formatDate(scheduledRevote)}`,
    };
  }

  if (!role.is_recurring) {
    return {
      dueDate: null,
      isOverdue: false,
      label: 'Open term',
    };
  }

  const dueDate = computeRoleScheduledRevoteDate({
    termStartDate: role.term_start_date,
    recurrencePattern: role.recurrence_pattern,
    recurrenceInterval: role.recurrence_interval,
  });

  if (!dueDate) {
    return {
      dueDate: null,
      isOverdue: false,
      label: 'Recurring term',
    };
  }

  return {
    dueDate,
    isOverdue: dueDate <= referenceTime,
    label:
      dueDate <= referenceTime
        ? `Overdue since ${formatDate(dueDate)}`
        : `Next revote ${formatDate(dueDate)}`,
  };
}

export async function scheduleRoleRevote(params: ScheduleRevoteParams): Promise<number | null> {
  const recurrencePattern =
    params.termDuration === 'yearly'
      ? 'yearly'
      : params.termDuration === 'biannual'
        ? 'yearly'
        : null;

  const recurrenceInterval = params.termDuration === 'biannual' ? 2 : 1;

  return computeRoleScheduledRevoteDate({
    termStartDate: params.termStartDate,
    recurrencePattern,
    recurrenceInterval,
  });
}

function addYears(timestamp: number, years: number) {
  const next = new Date(timestamp);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next.getTime();
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

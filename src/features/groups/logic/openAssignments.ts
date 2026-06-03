import { parseDelegateElectionMetadata } from '@/features/elections/logic/electionAssignmentMetadata';
import { computeRoleScheduledRevoteDate } from '@/features/votes/utils/revote-scheduling';

export interface AssignmentEventSummary {
  id: string;
  title?: string | null;
  status?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  delegate_election_mode?: string | null;
  group?: {
    id?: string | null;
    name?: string | null;
  } | null;
}

export interface DelegateAllocationAssignmentLike {
  id: string;
  allocated_seats?: number | null;
  event?:
    | (AssignmentEventSummary & {
        delegates?:
          | readonly {
              user_id?: string | null;
              group_id?: string | null;
              seat_count?: number | null;
              status?: string | null;
            }[]
          | null;
      })
    | null;
  group?: {
    id?: string | null;
    name?: string | null;
  } | null;
}

export interface GroupRoleAssignmentLike {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  assignment_mode?: string | null;
  scope?: string | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  term_start_date?: number | null;
  scheduled_revote_date?: number | null;
  elections?:
    | readonly {
        id: string;
        status?: string | null;
        description?: string | null;
        agenda_item?: {
          event?: AssignmentEventSummary | null;
        } | null;
      }[]
    | null;
}

export interface ProcessTaskAssignmentLike {
  id: string;
  task_type?: string | null;
  status?: string | null;
  title?: string | null;
  description?: string | null;
  due_at?: number | null;
  event?: AssignmentEventSummary | null;
  agenda_item?: {
    id?: string | null;
  } | null;
  step_run?: {
    event?: AssignmentEventSummary | null;
  } | null;
  target_group?: {
    id?: string | null;
    name?: string | null;
  } | null;
  process_run?: {
    amendment?: {
      id?: string | null;
      title?: string | null;
    } | null;
  } | null;
  support_confirmation?: {
    id?: string | null;
    amendment?: {
      id?: string | null;
      title?: string | null;
    } | null;
  } | null;
}

export type OpenAssignmentStatus = 'open' | 'scheduled' | 'completed';

export interface GroupOpenAssignment {
  id: string;
  kind: 'delegate_election' | 'role_renewal' | 'process_task';
  status: OpenAssignmentStatus;
  title: string;
  description: string;
  seatCount?: number;
  scheduledSeatCount?: number;
  completedSeatCount?: number;
  remainingSeatCount?: number;
  roleId?: string;
  linkedEvent?: AssignmentEventSummary | null;
  targetEvent?: AssignmentEventSummary | null;
  processTaskId?: string;
  processTaskType?: string | null;
  amendmentId?: string | null;
  dueAt?: number | null;
}

function isFutureOrOngoingEvent(
  event: AssignmentEventSummary | null | undefined,
  referenceTime: number
) {
  if (!event || event.status === 'cancelled') {
    return false;
  }

  const endDate = event.end_date ?? event.start_date ?? 0;
  return endDate >= referenceTime;
}

export function getRemainingSeatCount(
  assignment: Pick<GroupOpenAssignment, 'remainingSeatCount' | 'seatCount'>
) {
  return Math.max(0, assignment.remainingSeatCount ?? assignment.seatCount ?? 0);
}

export function getNextRoleElectionEvent(
  role: Pick<GroupRoleAssignmentLike, 'elections'>,
  referenceTime: number = Date.now()
) {
  const candidateEvents = (role.elections || [])
    .map(election => election.agenda_item?.event || null)
    .filter((event): event is AssignmentEventSummary => Boolean(event?.id))
    .filter(event => isFutureOrOngoingEvent(event, referenceTime))
    .sort(
      (left, right) =>
        (left.start_date ?? Number.MAX_SAFE_INTEGER) - (right.start_date ?? Number.MAX_SAFE_INTEGER)
    );

  return candidateEvents[0] ?? null;
}

export function buildDelegateElectionAssignments(args: {
  currentGroupId: string;
  allocations: readonly DelegateAllocationAssignmentLike[];
  roles: readonly GroupRoleAssignmentLike[];
  referenceTime?: number;
}) {
  const referenceTime = args.referenceTime ?? Date.now();
  const scheduledSeatIdsByTargetEventId = new Map<string, Set<string>>();
  const linkedEventByTargetEventId = new Map<string, AssignmentEventSummary>();

  for (const role of args.roles) {
    for (const election of role.elections || []) {
      const metadata = parseDelegateElectionMetadata(election.description);
      if (!metadata || metadata.sourceGroupId !== args.currentGroupId) {
        continue;
      }

      const linkedEvent = election.agenda_item?.event || null;
      if (!isFutureOrOngoingEvent(linkedEvent, referenceTime)) {
        continue;
      }

      const scheduledSeatIds =
        scheduledSeatIdsByTargetEventId.get(metadata.targetEventId) ?? new Set<string>();
      for (const seatRoleId of metadata.allSeatRoleIds) {
        scheduledSeatIds.add(seatRoleId);
      }
      scheduledSeatIdsByTargetEventId.set(metadata.targetEventId, scheduledSeatIds);

      const existingLinkedEvent = linkedEventByTargetEventId.get(metadata.targetEventId);
      if (
        linkedEvent &&
        (!existingLinkedEvent ||
          (linkedEvent.start_date ?? Number.MAX_SAFE_INTEGER) <
            (existingLinkedEvent.start_date ?? Number.MAX_SAFE_INTEGER))
      ) {
        linkedEventByTargetEventId.set(metadata.targetEventId, linkedEvent);
      }
    }
  }

  return args.allocations
    .filter(allocation => (allocation.allocated_seats ?? 0) > 0 && allocation.event?.id)
    .map<GroupOpenAssignment>(allocation => {
      const targetEvent = allocation.event || null;
      const seatCount = Math.max(0, allocation.allocated_seats ?? 0);
      const completedSeatCount = Math.max(
        0,
        (allocation.event?.delegates || [])
          .filter(
            delegate => delegate.group_id === args.currentGroupId && delegate.status === 'confirmed'
          )
          .reduce((sum, delegate) => sum + Math.max(1, delegate.seat_count ?? 1), 0)
      );
      const scheduledSeatCount = Math.max(
        0,
        scheduledSeatIdsByTargetEventId.get(targetEvent?.id || '')?.size ?? 0
      );
      const remainingSeatCount = Math.max(0, seatCount - completedSeatCount - scheduledSeatCount);
      const status: OpenAssignmentStatus =
        completedSeatCount >= seatCount
          ? 'completed'
          : scheduledSeatCount > 0
            ? 'scheduled'
            : 'open';

      return {
        id: `delegate:${allocation.id}`,
        kind: 'delegate_election',
        status,
        title: `Delegiertenwahl fuer ${targetEvent?.title || 'Ziel-Event'}`,
        description: `${allocation.group?.name || 'Diese Untergruppe'} hat aktuell ${seatCount} Delegiertensitz${seatCount === 1 ? '' : 'e'} fuer ${targetEvent?.group?.name || 'die Zielgruppe'}.`,
        seatCount,
        scheduledSeatCount,
        completedSeatCount,
        remainingSeatCount,
        linkedEvent: linkedEventByTargetEventId.get(targetEvent?.id || '') ?? null,
        targetEvent,
      };
    })
    .sort(
      (left, right) =>
        statusSortOrder(left.status) - statusSortOrder(right.status) ||
        (left.targetEvent?.start_date ?? Number.MAX_SAFE_INTEGER) -
          (right.targetEvent?.start_date ?? Number.MAX_SAFE_INTEGER)
    );
}

export function buildRoleRenewalAssignments(args: {
  roles: readonly GroupRoleAssignmentLike[];
  referenceTime?: number;
}) {
  const referenceTime = args.referenceTime ?? Date.now();

  return args.roles
    .filter(
      role =>
        role.scope === 'group' &&
        role.assignment_mode === 'elected' &&
        Boolean(role.is_recurring || role.scheduled_revote_date)
    )
    .map<GroupOpenAssignment>(role => {
      const linkedEvent = getNextRoleElectionEvent(role, referenceTime);
      const dueDate =
        role.scheduled_revote_date ??
        computeRoleScheduledRevoteDate({
          termStartDate: role.term_start_date,
          recurrencePattern: role.recurrence_pattern,
          recurrenceInterval: role.recurrence_interval,
        });
      const status: OpenAssignmentStatus =
        linkedEvent && isFutureOrOngoingEvent(linkedEvent, referenceTime) ? 'scheduled' : 'open';

      return {
        id: `role:${role.id}`,
        kind: 'role_renewal',
        status,
        title: `Neuwahl fuer ${role.title || role.name || 'Rolle'}`,
        description: dueDate
          ? `Die naechste turnusmaessige Wahl ist fuer ${new Date(dueDate).toLocaleDateString('de-DE')} vorgesehen.`
          : 'Diese Rolle braucht eine neue Wahl, sobald ein passendes Event geplant ist.',
        roleId: role.id,
        linkedEvent,
      };
    })
    .sort(
      (left, right) =>
        statusSortOrder(left.status) - statusSortOrder(right.status) ||
        (left.linkedEvent?.start_date ?? Number.MAX_SAFE_INTEGER) -
          (right.linkedEvent?.start_date ?? Number.MAX_SAFE_INTEGER)
    );
}

export function buildOpenAssignments(args: {
  currentGroupId: string;
  allocations: readonly DelegateAllocationAssignmentLike[];
  roles: readonly GroupRoleAssignmentLike[];
  processTasks?: readonly ProcessTaskAssignmentLike[];
  referenceTime?: number;
}) {
  return [
    ...buildDelegateElectionAssignments(args),
    ...buildRoleRenewalAssignments(args),
    ...buildProcessTaskAssignments(args.processTasks ?? []),
  ].sort(
    (left, right) =>
      statusSortOrder(left.status) - statusSortOrder(right.status) ||
      (left.dueAt ??
        left.targetEvent?.start_date ??
        left.linkedEvent?.start_date ??
        Number.MAX_SAFE_INTEGER) -
        (right.dueAt ??
          right.targetEvent?.start_date ??
          right.linkedEvent?.start_date ??
          Number.MAX_SAFE_INTEGER)
  );
}

function statusSortOrder(status: OpenAssignmentStatus) {
  switch (status) {
    case 'open':
      return 0;
    case 'scheduled':
      return 1;
    case 'completed':
      return 2;
    default:
      return 3;
  }
}

function buildProcessTaskAssignments(processTasks: readonly ProcessTaskAssignmentLike[]) {
  return processTasks
    .map<GroupOpenAssignment>(task => {
      const amendment = task.process_run?.amendment ?? task.support_confirmation?.amendment ?? null;
      const amendmentTitle = amendment?.title || 'Aenderungsantrag';
      const linkedEvent = task.event ?? task.step_run?.event ?? null;
      const status: OpenAssignmentStatus =
        task.status === 'completed'
          ? 'completed'
          : linkedEvent || task.agenda_item?.id
            ? 'scheduled'
            : 'open';

      let title = task.title?.trim() || '';
      let description = task.description?.trim() || '';

      if (!title) {
        switch (task.task_type) {
          case 'implementation_evaluation':
            title = `Umsetzung evaluieren: ${amendmentTitle}`;
            break;
          case 'support_confirmation':
            title = `Unterstuetzung bestaetigen: ${amendmentTitle}`;
            break;
          default:
            title = `Event planen: ${amendmentTitle}`;
            break;
        }
      }

      if (!description) {
        const targetGroupName = task.target_group?.name || 'die zustandige Gruppe';
        switch (task.task_type) {
          case 'implementation_evaluation':
            description = `Plane die Umsetzungspruefung fuer ${amendmentTitle} in ${targetGroupName}.`;
            break;
          case 'support_confirmation':
            description = `Diese Gruppe muss ihre Unterstuetzung fuer ${amendmentTitle} erneut bestaetigen.`;
            break;
          default:
            description = `Fuer ${amendmentTitle} fehlt noch ein passendes Event in ${targetGroupName}.`;
            break;
        }
      }

      return {
        id: `process-task:${task.id}`,
        kind: 'process_task',
        status,
        title,
        description,
        linkedEvent,
        processTaskId: task.id,
        processTaskType: task.task_type ?? null,
        amendmentId: amendment?.id ?? null,
        dueAt: task.due_at ?? null,
      };
    })
    .sort(
      (left, right) =>
        statusSortOrder(left.status) - statusSortOrder(right.status) ||
        (left.dueAt ?? left.linkedEvent?.start_date ?? Number.MAX_SAFE_INTEGER) -
          (right.dueAt ?? right.linkedEvent?.start_date ?? Number.MAX_SAFE_INTEGER)
    );
}

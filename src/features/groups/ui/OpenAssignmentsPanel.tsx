import { featureThemeClassName } from '@/features/shared/theme';
import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { useMemo, useState, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { CalendarPlus2, CheckCircle2, Clock3, Search, Vote } from 'lucide-react';
import {
  getElectionModeLabel,
  normalizeDelegateElectionMode,
} from '@/features/elections/logic/electionMode';
import {
  buildCreateEventSearchFromProcessTask,
  getProcessTaskSchedulingWindow,
  getSchedulingWindowDisplayLabel,
  isEventWithinSchedulingWindow,
} from '@/features/amendments/logic/processTaskEventScheduling';
import {
  buildCreateEventSearchFromDelegateElectionAssignment,
  isEventWithinDelegateElectionSchedulingWindow,
} from '@/features/groups/logic/delegateElectionScheduling';
import { getDelegateMembersPerSeatInfo } from '@/features/delegates/logic/delegateRatio';
import {
  createElectionFlowCorrelationId,
  logElectionFlowClient,
} from '@/features/elections/logic/electionFlowLogging';
import {
  getRemainingSeatCount,
  type GroupOpenAssignment,
} from '@/features/groups/logic/openAssignments';
import { type ColumnDef } from '@/features/shared/ui/data-table';
import { CountBadge, EntityBadge, StatusBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import type { DelegateElectionMode } from '../hooks/useGroupOpenAssignments';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { OpenAssignmentsPanelView } from './OpenAssignmentsPanelView';

interface AvailableEventLike {
  id: string;
  title?: string | null;
  status?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  group_id?: string | null;
}

interface OpenAssignmentsPanelProps {
  groupId: string;
  groupName?: string | null;
  assignments: GroupOpenAssignment[];
  availableEvents: AvailableEventLike[];
  isLoading?: boolean;
  isScheduling?: boolean;
  focusAssignmentId?: string;
  onScheduleRoleRenewal: (assignment: GroupOpenAssignment, eventId: string) => Promise<void>;
  onScheduleDelegateElection: (
    assignment: GroupOpenAssignment,
    eventId: string,
    mode: DelegateElectionMode
  ) => Promise<void>;
  onScheduleProcessTask: (assignment: GroupOpenAssignment, eventId: string) => Promise<void>;
}

interface OpenAssignmentTableRow {
  assignment: GroupOpenAssignment;
  remainingSeatCount: number;
}

type AssignmentStatusFilter = 'all' | GroupOpenAssignment['status'];
type AssignmentDecisionFilter = 'all' | 'votes' | 'elections';

interface AssignmentFilterBadgeOption<TValue extends string> {
  value: TValue;
  label: ReactNode;
}

function AssignmentFilterBadgeGroup<TValue extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: ReactNode;
  value: TValue;
  options: readonly AssignmentFilterBadgeOption<TValue>[];
  onValueChange: (value: TValue) => void;
}) {
  return (
    <div role="group" aria-label={String(label)} className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {options.map(option => {
        const selected = option.value === value;

        return (
          <Button
            key={option.value}
            type="button"
            variant={selected ? 'default' : 'outline'}
            size="sm"
            aria-pressed={selected}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function getStatusBadge(t: TFunction, assignment: GroupOpenAssignment) {
  switch (assignment.status) {
    case 'completed':
      return (
        <StatusBadge status="completed">
          {t('features.groups.memberships.openAssignments.status.completed')}
        </StatusBadge>
      );
    case 'scheduled':
      return (
        <StatusBadge status="scheduled">
          {t('features.groups.memberships.openAssignments.status.scheduled')}
        </StatusBadge>
      );
    default:
      return (
        <StatusBadge status="open">
          {t('features.groups.memberships.openAssignments.status.open')}
        </StatusBadge>
      );
  }
}

function getAssignmentTypeBadge(t: TFunction, assignment: GroupOpenAssignment) {
  switch (assignment.kind) {
    case 'delegate_election':
      return (
        <StatusBadge status="delegate" tone="info">
          {t('features.groups.memberships.openAssignments.type.delegateElection')}
        </StatusBadge>
      );
    case 'role_renewal':
      return (
        <StatusBadge status="role-renewal" tone="warning">
          {t('features.groups.memberships.openAssignments.type.roleRenewal')}
        </StatusBadge>
      );
    case 'process_task':
      return (
        <StatusBadge status="process-task" tone="neutral">
          {assignment.processTaskType === 'implementation_evaluation'
            ? t('features.groups.memberships.openAssignments.type.implementationEvaluation')
            : assignment.processTaskType === 'support_confirmation'
              ? t('features.groups.memberships.openAssignments.type.supportConfirmation')
              : t('features.groups.memberships.openAssignments.type.processTask')}
        </StatusBadge>
      );
    default:
      return (
        <StatusBadge status="assignment" tone="neutral">
          {t('features.groups.memberships.openAssignments.type.assignment')}
        </StatusBadge>
      );
  }
}

function getDefaultEventId(
  assignment: GroupOpenAssignment,
  availableEvents: readonly AvailableEventLike[],
  selectedEventIds: Record<string, string>
) {
  const selectedEventId = selectedEventIds[assignment.id];
  if (selectedEventId && availableEvents.some(event => event.id === selectedEventId)) {
    return selectedEventId;
  }

  if (
    assignment.linkedEvent?.id &&
    availableEvents.some(event => event.id === assignment.linkedEvent?.id)
  ) {
    return assignment.linkedEvent.id;
  }

  return assignment.targetEvent?.id &&
    availableEvents.some(event => event.id === assignment.targetEvent?.id)
    ? assignment.targetEvent.id
    : availableEvents[0]?.id || '';
}

function buildProcessTaskScheduleSource(assignment: GroupOpenAssignment, groupId: string) {
  if (assignment.kind !== 'process_task' || !assignment.processTaskId) {
    return null;
  }

  return {
    id: assignment.processTaskId,
    group_id: groupId,
    process_run_id: assignment.processRunId ?? null,
    step_run_id: assignment.stepRunId ?? null,
    due_at: assignment.dueAt ?? null,
    metadata: assignment.processTaskMetadata,
  };
}

function getEligibleEventsForAssignment(
  assignment: GroupOpenAssignment,
  groupId: string,
  availableEvents: readonly AvailableEventLike[]
) {
  if (assignment.kind === 'delegate_election') {
    return availableEvents.filter(event =>
      isEventWithinDelegateElectionSchedulingWindow(event, assignment)
    );
  }

  const task = buildProcessTaskScheduleSource(assignment, groupId);
  if (!task) {
    return [...availableEvents];
  }

  const schedulingWindow = getProcessTaskSchedulingWindow(task);
  return availableEvents.filter(event => isEventWithinSchedulingWindow(event, schedulingWindow));
}

function getAssignmentSchedulingWindowLabel(assignment: GroupOpenAssignment, groupId: string) {
  if (assignment.kind === 'delegate_election') {
    const createEventSearch = buildCreateEventSearchFromDelegateElectionAssignment({
      assignment,
      groupId,
    });

    return getSchedulingWindowDisplayLabel({
      minStartDate: createEventSearch.minStartDate ?? null,
      minStartTime: createEventSearch.minStartTime ?? null,
      maxStartDate: createEventSearch.maxStartDate ?? null,
      maxStartTime: createEventSearch.maxStartTime ?? null,
    });
  }

  const task = buildProcessTaskScheduleSource(assignment, groupId);
  if (!task) {
    return null;
  }

  const createEventSearch = buildCreateEventSearchFromProcessTask({
    task,
    groupId,
  });

  return getSchedulingWindowDisplayLabel({
    minStartDate: createEventSearch.minStartDate ?? null,
    minStartTime: createEventSearch.minStartTime ?? null,
    maxStartDate: createEventSearch.maxStartDate ?? null,
    maxStartTime: createEventSearch.maxStartTime ?? null,
  });
}

function buildCreateEventSearchForAssignment(assignment: GroupOpenAssignment, groupId: string) {
  const openAssignmentsReturnTo = `/group/${groupId}/memberships?tab=openAssignments`;
  const returnTo =
    assignment.kind === 'role_renewal'
      ? `${openAssignmentsReturnTo}&assignmentId=${assignment.id}`
      : openAssignmentsReturnTo;

  if (assignment.kind === 'delegate_election') {
    return buildCreateEventSearchFromDelegateElectionAssignment({
      assignment,
      groupId,
      returnTo,
    });
  }

  if (assignment.kind === 'process_task' && assignment.processTaskId) {
    return buildCreateEventSearchFromProcessTask({
      task: {
        id: assignment.processTaskId,
        group_id: groupId,
        process_run_id: assignment.processRunId ?? null,
        step_run_id: assignment.stepRunId ?? null,
        due_at: assignment.dueAt ?? null,
        metadata: assignment.processTaskMetadata,
      },
      groupId,
      returnTo,
    });
  }

  return assignment.kind === 'role_renewal' ? { groupId, returnTo } : { groupId };
}

function formatDateTime(timestamp: number | null | undefined, locale: string) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EventTag({
  event,
  label,
}: {
  event:
    | AvailableEventLike
    | NonNullable<GroupOpenAssignment['targetEvent']>
    | NonNullable<GroupOpenAssignment['linkedEvent']>;
  label: string;
}) {
  return (
    <EntityBadge asChild tone="info" className="max-w-full hover:opacity-90">
      <a href={`/event/${event.id}`} className="inline-flex">
        <span className="truncate">
          {label}: {event.title || translateText('generated.inline.0102_veranstaltung_e6fdb4cc')}
        </span>
      </a>
    </EntityBadge>
  );
}

function AmendmentTag({ amendment }: { amendment: NonNullable<GroupOpenAssignment['amendment']> }) {
  return (
    <EntityBadge asChild tone="accent" className="max-w-full hover:opacity-90">
      <a href={`/amendment/${amendment.id}`} className="inline-flex">
        <span className="truncate">{amendment.title}</span>
      </a>
    </EntityBadge>
  );
}

function GroupInlineLink({
  group,
  fallback,
}: {
  group?: GroupOpenAssignment['sourceGroup'] | GroupOpenAssignment['targetGroup'];
  fallback: string;
}) {
  const label = group?.name || fallback;

  if (!group?.id) {
    return <>{label}</>;
  }

  return (
    <a
      href={`/group/${group.id}`}
      className="text-primary underline-offset-4 hover:underline"
      title={label}
    >
      {label}
    </a>
  );
}

function DelegateAssignmentDescription({ assignment }: { assignment: GroupOpenAssignment }) {
  const { t } = useTranslation();
  const sourceGroupFallback =
    assignment.sourceGroup?.name ||
    t('features.groups.memberships.openAssignments.delegateDescription.sourceGroupFallback');
  const targetGroupFallback =
    assignment.targetGroup?.name ||
    t('features.groups.memberships.openAssignments.delegateDescription.targetGroupFallback');
  const seatCount = assignment.seatCount ?? 0;

  return (
    <p className="text-muted-foreground text-sm">
      <GroupInlineLink group={assignment.sourceGroup} fallback={sourceGroupFallback} />{' '}
      {t('features.groups.memberships.openAssignments.delegateDescription.hasCurrently')}{' '}
      {seatCount.toLocaleString()}{' '}
      {seatCount === 1
        ? t('features.groups.memberships.openAssignments.delegateDescription.seatSingular')
        : t('features.groups.memberships.openAssignments.delegateDescription.seatPlural')}{' '}
      {t('features.groups.memberships.openAssignments.delegateDescription.for')}{' '}
      <GroupInlineLink group={assignment.targetGroup} fallback={targetGroupFallback} />.
    </p>
  );
}

function DelegateElectionHelp({
  assignment,
  fallbackGroupName,
}: {
  assignment: GroupOpenAssignment;
  fallbackGroupName: string;
}) {
  const { t } = useTranslation();

  return (
    <p className="text-muted-foreground text-sm">
      {t('features.groups.memberships.openAssignments.delegateElectionHelpBeforeGroup')}{' '}
      <GroupInlineLink group={assignment.sourceGroup} fallback={fallbackGroupName} />{' '}
      {t('features.groups.memberships.openAssignments.delegateElectionHelpAfterGroup')}
    </p>
  );
}

function RoleRenewalHelp({ assignment }: { assignment: GroupOpenAssignment }) {
  const { t } = useTranslation();

  return (
    <p className="text-muted-foreground text-sm">
      {t('features.groups.memberships.openAssignments.roleRenewalHelp', {
        roleTitle: assignment.title,
        defaultValue:
          'Choose an upcoming or ongoing event where this role election should be created.',
      })}
    </p>
  );
}

function getAssignmentSearchFlow(assignment: GroupOpenAssignment) {
  return assignment.kind === 'role_renewal'
    ? 'role-renewal-assignment-search'
    : 'delegate-assignment-search';
}

function matchesAssignmentDecisionFilter(
  assignment: GroupOpenAssignment,
  filter: AssignmentDecisionFilter
) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'elections') {
    return assignment.kind === 'delegate_election' || assignment.kind === 'role_renewal';
  }

  return assignment.kind === 'process_task' && assignment.processTaskType === 'schedule_event';
}

export function OpenAssignmentsPanel({
  groupId,
  groupName,
  assignments,
  availableEvents,
  isLoading = false,
  isScheduling = false,
  focusAssignmentId,
  onScheduleRoleRenewal,
  onScheduleDelegateElection,
  onScheduleProcessTask,
}: OpenAssignmentsPanelProps) {
  const { t, i18n } = useTranslation();
  const [selectedEventIds, setSelectedEventIds] = useState<Record<string, string>>({});
  const [eventDialogAssignmentId, setEventDialogAssignmentId] = useState<string | null>(null);
  const [eventDialogEventId, setEventDialogEventId] = useState<string>('');
  const [eventDialogSearchQuery, setEventDialogSearchQuery] = useState('');
  const [eventDialogCorrelationId, setEventDialogCorrelationId] = useState<string | null>(null);
  const [agendaPreviewAssignmentId, setAgendaPreviewAssignmentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AssignmentStatusFilter>('all');
  const [decisionFilter, setDecisionFilter] = useState<AssignmentDecisionFilter>('all');

  const assignmentsWithProgress = useMemo(
    () =>
      assignments.map(assignment => ({
        assignment,
        remainingSeatCount:
          assignment.kind === 'delegate_election' ? getRemainingSeatCount(assignment) : 0,
      })),
    [assignments]
  );

  const filteredAssignmentsWithProgress = useMemo(
    () =>
      assignmentsWithProgress.filter(({ assignment }) => {
        const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
        return matchesStatus && matchesAssignmentDecisionFilter(assignment, decisionFilter);
      }),
    [assignmentsWithProgress, decisionFilter, statusFilter]
  );

  const activeEventAssignment = useMemo(
    () =>
      assignments.find(
        assignment =>
          (assignment.kind === 'delegate_election' || assignment.kind === 'role_renewal') &&
          assignment.id === eventDialogAssignmentId
      ) ?? null,
    [assignments, eventDialogAssignmentId]
  );
  const activeAgendaPreviewAssignment = useMemo(
    () =>
      assignments.find(
        assignment =>
          assignment.kind === 'process_task' && assignment.id === agendaPreviewAssignmentId
      ) ?? null,
    [agendaPreviewAssignmentId, assignments]
  );

  const eventDialogAvailableEvents = useMemo(
    () =>
      activeEventAssignment
        ? getEligibleEventsForAssignment(activeEventAssignment, groupId, availableEvents)
        : [],
    [activeEventAssignment, availableEvents, groupId]
  );

  const filteredEventDialogEvents = useMemo(() => {
    const normalizedQuery = eventDialogSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return eventDialogAvailableEvents;
    }

    return eventDialogAvailableEvents.filter(event =>
      [event.title].filter(Boolean).some(value => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [eventDialogAvailableEvents, eventDialogSearchQuery]);

  const openEventDialog = (assignment: GroupOpenAssignment) => {
    const flow = getAssignmentSearchFlow(assignment);
    const correlationId = createElectionFlowCorrelationId(flow);
    const eligibleEvents = getEligibleEventsForAssignment(assignment, groupId, availableEvents);
    setEventDialogAssignmentId(assignment.id);
    setEventDialogEventId(getDefaultEventId(assignment, eligibleEvents, selectedEventIds));
    setEventDialogSearchQuery('');
    setEventDialogCorrelationId(correlationId);

    logElectionFlowClient(flow, 'dialog-opened', {
      correlationId,
      assignmentId: assignment.id,
      assignmentKind: assignment.kind,
      targetEventId: assignment.targetEvent?.id ?? null,
      targetEventTitle: assignment.targetEvent?.title ?? null,
      remainingSeatCount: getRemainingSeatCount(assignment),
    });
  };

  const closeEventDialog = (open: boolean) => {
    if (open) {
      return;
    }

    setEventDialogAssignmentId(null);
    setEventDialogEventId('');
    setEventDialogSearchQuery('');
    setEventDialogCorrelationId(null);
  };

  const handleCreateAssignmentElection = async () => {
    if (!activeEventAssignment || !eventDialogEventId) {
      return;
    }

    const flow = getAssignmentSearchFlow(activeEventAssignment);
    const mode =
      activeEventAssignment.kind === 'delegate_election'
        ? normalizeDelegateElectionMode(activeEventAssignment.targetEvent?.delegate_election_mode)
        : null;

    logElectionFlowClient(flow, 'create-clicked', {
      correlationId: eventDialogCorrelationId,
      assignmentId: activeEventAssignment.id,
      assignmentKind: activeEventAssignment.kind,
      selectedEventId: eventDialogEventId,
      mode,
    });

    if (activeEventAssignment.kind === 'delegate_election') {
      await onScheduleDelegateElection(
        activeEventAssignment,
        eventDialogEventId,
        normalizeDelegateElectionMode(activeEventAssignment.targetEvent?.delegate_election_mode)
      );
    } else {
      await onScheduleRoleRenewal(activeEventAssignment, eventDialogEventId);
    }

    closeEventDialog(false);
  };

  const isAmendmentProcessAssignment = (assignment: GroupOpenAssignment) =>
    assignment.kind === 'process_task' &&
    assignment.processTaskType !== 'implementation_evaluation' &&
    assignment.processTaskType !== 'support_confirmation' &&
    Boolean(assignment.amendment?.id);

  const assignmentFilters = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      <AssignmentFilterBadgeGroup<AssignmentStatusFilter>
        label={t('features.groups.memberships.openAssignments.filters.status')}
        value={statusFilter}
        onValueChange={setStatusFilter}
        options={[
          {
            value: 'all',
            label: t('features.groups.memberships.openAssignments.filters.all'),
          },
          {
            value: 'open',
            label: t('features.groups.memberships.openAssignments.status.open'),
          },
          {
            value: 'scheduled',
            label: t('features.groups.memberships.openAssignments.status.scheduled'),
          },
          {
            value: 'completed',
            label: t('features.groups.memberships.openAssignments.status.completed'),
          },
        ]}
      />
      <AssignmentFilterBadgeGroup<AssignmentDecisionFilter>
        label={t('features.groups.memberships.openAssignments.filters.assignmentKind')}
        value={decisionFilter}
        onValueChange={setDecisionFilter}
        options={[
          {
            value: 'all',
            label: t('features.groups.memberships.openAssignments.filters.all'),
          },
          {
            value: 'votes',
            label: t('features.groups.memberships.openAssignments.filters.votes'),
          },
          {
            value: 'elections',
            label: t('features.groups.memberships.openAssignments.filters.elections'),
          },
        ]}
      />
    </div>
  );

  const assignmentColumns: ColumnDef<OpenAssignmentTableRow>[] = [
    {
      id: 'assignment',
      header: t('features.groups.memberships.openAssignments.columns.assignment'),
      cell: ({ row }) => {
        const { assignment, remainingSeatCount } = row.original;
        const dueAtLabel = formatDateTime(assignment.dueAt, i18n.language);
        const delegateRatioInfo =
          assignment.kind === 'delegate_election'
            ? getDelegateMembersPerSeatInfo(assignment.targetEvent)
            : null;

        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              {assignment.kind === 'delegate_election' ? (
                <Vote className="mt-0.5 h-4 w-4 flex-shrink-0" />
              ) : (
                <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium">{assignment.title}</p>
                {assignment.kind === 'delegate_election' ? (
                  <DelegateAssignmentDescription assignment={assignment} />
                ) : (
                  <p className="text-muted-foreground text-sm">{assignment.description}</p>
                )}
              </div>
            </div>

            {assignment.kind === 'delegate_election' ? (
              <div className="flex flex-wrap gap-2">
                <CountBadge
                  count={assignment.seatCount ?? 0}
                  label={t('features.groups.memberships.openAssignments.seatCount')}
                />
                <CountBadge
                  count={assignment.completedSeatCount ?? 0}
                  label={t('features.groups.memberships.openAssignments.completedSeatCount')}
                  tone="success"
                />
                <CountBadge
                  count={assignment.scheduledSeatCount ?? 0}
                  label={t('features.groups.memberships.openAssignments.scheduledSeatCount')}
                  tone="warning"
                />
                <CountBadge
                  count={remainingSeatCount}
                  label={t('features.groups.memberships.openAssignments.openSeatCount')}
                  tone="info"
                />
                <StatusBadge status="delegate-mode" tone="neutral" className="font-normal">
                  {getElectionModeLabel(
                    normalizeDelegateElectionMode(assignment.targetEvent?.delegate_election_mode)
                  )}
                </StatusBadge>
                {delegateRatioInfo ? (
                  <StatusBadge status="delegate-ratio" tone="neutral" className="font-normal">
                    {t(delegateRatioInfo.translationKey, { count: delegateRatioInfo.count })}
                  </StatusBadge>
                ) : null}
              </div>
            ) : null}

            {dueAtLabel ? (
              <p className="text-muted-foreground text-xs">
                {t('features.groups.memberships.openAssignments.dueAt')}: {dueAtLabel}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'type',
      header: t('features.groups.memberships.openAssignments.columns.type'),
      cell: ({ row }) => getAssignmentTypeBadge(t, row.original.assignment),
    },
    {
      id: 'status',
      header: t('features.groups.memberships.openAssignments.columns.status'),
      cell: ({ row }) => getStatusBadge(t, row.original.assignment),
    },
    {
      id: 'amendment',
      header: t('features.groups.memberships.openAssignments.columns.amendment'),
      cell: ({ row }) =>
        row.original.assignment.amendment ? (
          <div className="flex flex-wrap gap-2">
            <AmendmentTag amendment={row.original.assignment.amendment} />
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">
            {t('features.groups.memberships.openAssignments.noAmendment')}
          </span>
        ),
    },
    {
      id: 'events',
      header: t('features.groups.memberships.openAssignments.columns.events'),
      cell: ({ row }) => {
        const { assignment } = row.original;

        return (
          <div className="flex flex-wrap gap-2">
            {assignment.targetEvent?.id ? (
              <EventTag
                event={assignment.targetEvent}
                label={t('features.groups.memberships.openAssignments.targetEventLabel')}
              />
            ) : null}
            {assignment.linkedEvent?.id ? (
              <EventTag
                event={assignment.linkedEvent}
                label={t('features.groups.memberships.openAssignments.linkedEventLabel')}
              />
            ) : null}
            {!assignment.targetEvent?.id && !assignment.linkedEvent?.id ? (
              <span className="text-muted-foreground text-sm">
                {t('features.groups.memberships.openAssignments.noEventLinked')}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'action',
      header: t('features.groups.memberships.openAssignments.columns.action'),
      meta: {
        className: 'w-[26rem]',
      },
      cell: ({ row }) => {
        const { assignment, remainingSeatCount } = row.original;
        const eligibleEvents = getEligibleEventsForAssignment(assignment, groupId, availableEvents);
        const selectedEventId = getDefaultEventId(assignment, eligibleEvents, selectedEventIds);
        const schedulingWindowLabel = getAssignmentSchedulingWindowLabel(assignment, groupId);
        const showAgendaPreviewButton = isAmendmentProcessAssignment(assignment);
        const canScheduleMore =
          assignment.kind === 'delegate_election'
            ? remainingSeatCount > 0
            : assignment.status !== 'completed';

        if (!canScheduleMore) {
          return (
            <div className="space-y-3">
              <div className={featureThemeClassName('groupOpenAssignmentsPanelSuccessBadge')}>
                <CheckCircle2 className="h-4 w-4" />
                {t('features.groups.memberships.openAssignments.completedBanner')}
              </div>
              {showAgendaPreviewButton ? (
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => setAgendaPreviewAssignmentId(assignment.id)}
                >
                  {t('features.groups.memberships.openAssignments.showAgendaItems')}
                </Button>
              ) : null}
              {assignment.kind === 'delegate_election' && assignment.linkedEvent?.id ? (
                <Button asChild variant="outline" className="w-full justify-center">
                  <a href={`/event/${assignment.linkedEvent.id}`}>
                    <Vote className="mr-2 h-4 w-4" />
                    {t('features.groups.memberships.openAssignments.toScheduledElection')}
                  </a>
                </Button>
              ) : null}
            </div>
          );
        }

        if (eligibleEvents.length === 0) {
          return (
            <div className="space-y-3 rounded-lg border border-dashed p-3">
              <p className="text-muted-foreground text-sm">
                {availableEvents.length === 0
                  ? t('features.groups.memberships.openAssignments.noEligibleEventsForGroup', {
                      groupName:
                        groupName || t('features.groups.memberships.openAssignments.thisGroup'),
                      defaultValue:
                        'There is currently no upcoming or ongoing event for {{groupName}}.',
                    })
                  : translateText(
                      'generated.inline.0103_keines_der_vorhandenen_events_liegt_im_erlaub_4c83a2ed'
                    )}
              </p>
              {schedulingWindowLabel ? (
                <p className="text-muted-foreground text-xs">{schedulingWindowLabel}</p>
              ) : null}
              <Button asChild variant="outline" className="w-full justify-center">
                <Link
                  to="/create/event"
                  search={buildCreateEventSearchForAssignment(assignment, groupId)}
                >
                  <CalendarPlus2 className="mr-2 h-4 w-4" />
                  {t('features.groups.memberships.openAssignments.createEvent')}
                </Link>
              </Button>
              {showAgendaPreviewButton ? (
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => setAgendaPreviewAssignmentId(assignment.id)}
                >
                  {t('features.groups.memberships.openAssignments.showAgendaItems')}
                </Button>
              ) : null}
            </div>
          );
        }

        if (assignment.kind === 'delegate_election' || assignment.kind === 'role_renewal') {
          const fallbackGroupName =
            groupName || t('features.groups.memberships.openAssignments.thisGroup');
          const searchLabel =
            assignment.kind === 'delegate_election'
              ? t('features.groups.memberships.openAssignments.searchDelegateElectionEvent')
              : t('features.groups.memberships.openAssignments.searchRoleRenewalEvent');

          return (
            <div className="space-y-2">
              {assignment.kind === 'delegate_election' ? (
                <DelegateElectionHelp
                  assignment={assignment}
                  fallbackGroupName={fallbackGroupName}
                />
              ) : (
                <RoleRenewalHelp assignment={assignment} />
              )}
              <Button
                className="w-full justify-center"
                disabled={isScheduling}
                onClick={() => openEventDialog(assignment)}
              >
                <Search className="mr-2 h-4 w-4" />
                {searchLabel}
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-3">
            {schedulingWindowLabel ? (
              <p className="text-muted-foreground text-xs">{schedulingWindowLabel}</p>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <FormControlLabel className="text-xs">
                  {t('features.groups.memberships.openAssignments.selectEventLabel')}
                </FormControlLabel>
                <FormControlSelect
                  value={selectedEventId}
                  onValueChange={value =>
                    setSelectedEventIds(current => ({
                      ...current,
                      [assignment.id]: value,
                    }))
                  }
                >
                  <FormControlSelectTrigger>
                    <FormControlSelectValue
                      placeholder={t(
                        'features.groups.memberships.openAssignments.selectEventPlaceholder'
                      )}
                    />
                  </FormControlSelectTrigger>
                  <FormControlSelectContent>
                    {eligibleEvents.map(event => (
                      <FormControlSelectItem key={event.id} value={event.id}>
                        {event.title ||
                          t('features.groups.memberships.openAssignments.eventFallback')}
                      </FormControlSelectItem>
                    ))}
                  </FormControlSelectContent>
                </FormControlSelect>
              </div>

              <div className="flex items-end">
                <Button
                  className="w-full justify-center"
                  disabled={!selectedEventId || isScheduling}
                  onClick={() => void onScheduleProcessTask(assignment, selectedEventId)}
                >
                  <CalendarPlus2 className="mr-2 h-4 w-4" />
                  {assignment.processTaskType === 'implementation_evaluation'
                    ? t('features.groups.memberships.openAssignments.scheduleImplementationReview')
                    : assignment.processTaskType === 'support_confirmation'
                      ? t('features.groups.memberships.openAssignments.scheduleConfirmation')
                      : t('features.groups.memberships.openAssignments.attachToEvent')}
                </Button>
              </div>
            </div>

            {showAgendaPreviewButton ? (
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => setAgendaPreviewAssignmentId(assignment.id)}
              >
                {t('features.groups.memberships.openAssignments.showAgendaItems')}
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
  return (
    <OpenAssignmentsPanelView
      groupId={groupId}
      groupName={groupName}
      assignments={assignments}
      availableEvents={availableEvents}
      isLoading={isLoading}
      isScheduling={isScheduling}
      focusAssignmentId={focusAssignmentId}
      onScheduleRoleRenewal={onScheduleRoleRenewal}
      onScheduleDelegateElection={onScheduleDelegateElection}
      onScheduleProcessTask={onScheduleProcessTask}
      t={t}
      i18n={i18n}
      selectedEventIds={selectedEventIds}
      setSelectedEventIds={setSelectedEventIds}
      eventDialogAssignmentId={eventDialogAssignmentId}
      setEventDialogAssignmentId={setEventDialogAssignmentId}
      eventDialogEventId={eventDialogEventId}
      setEventDialogEventId={setEventDialogEventId}
      eventDialogSearchQuery={eventDialogSearchQuery}
      setEventDialogSearchQuery={setEventDialogSearchQuery}
      eventDialogCorrelationId={eventDialogCorrelationId}
      setEventDialogCorrelationId={setEventDialogCorrelationId}
      agendaPreviewAssignmentId={agendaPreviewAssignmentId}
      setAgendaPreviewAssignmentId={setAgendaPreviewAssignmentId}
      filteredAssignmentsWithProgress={filteredAssignmentsWithProgress}
      assignmentFilters={assignmentFilters}
      activeEventAssignment={activeEventAssignment}
      activeAgendaPreviewAssignment={activeAgendaPreviewAssignment}
      filteredEventDialogEvents={filteredEventDialogEvents}
      openEventDialog={openEventDialog}
      closeEventDialog={closeEventDialog}
      handleCreateAssignmentElection={handleCreateAssignmentElection}
      isAmendmentProcessAssignment={isAmendmentProcessAssignment}
      assignmentColumns={assignmentColumns}
    />
  );
}

import { featureThemeClassName } from '@/features/shared/theme';
import {
  FormControlInput,
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { CalendarPlus2, CheckCircle2, Clock3, Search, Vote } from 'lucide-react';
import { buildTimelineCardProps } from '@/features/search/logic/buildTimelineCardProps';
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
  createElectionFlowCorrelationId,
  logElectionFlowClient,
} from '@/features/elections/logic/electionFlowLogging';
import {
  getRemainingSeatCount,
  type GroupOpenAssignment,
} from '@/features/groups/logic/openAssignments';
import { DynamicTimelineCard } from '@/features/timeline/ui/LazyCardComponents';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { CountBadge, EntityBadge, StatusBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { cn } from '@/features/shared/utils/utils';
import { ProcessAgendaPreviewDialog } from '@/features/groups/ui/ProcessAgendaPreviewDialog';
import type { DelegateElectionMode } from '../hooks/useGroupOpenAssignments';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  const task = buildProcessTaskScheduleSource(assignment, groupId);
  if (!task) {
    return [...availableEvents];
  }

  const schedulingWindow = getProcessTaskSchedulingWindow(task);
  return availableEvents.filter(event => isEventWithinSchedulingWindow(event, schedulingWindow));
}

function getAssignmentSchedulingWindowLabel(assignment: GroupOpenAssignment, groupId: string) {
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

function buildEventCard(
  event:
    | AvailableEventLike
    | NonNullable<GroupOpenAssignment['targetEvent']>
    | NonNullable<GroupOpenAssignment['linkedEvent']>,
  onSelect?: () => void
) {
  const { cardType, cardProps } = buildTimelineCardProps({
    id: event.id,
    type: 'event',
    eventId: event.id,
    title: event.title || 'Veranstaltung',
    description: undefined,
    createdAt: new Date(event.start_date ?? Date.now()),
    startDate: event.start_date ? new Date(event.start_date) : new Date(),
    endDate: event.end_date ? new Date(event.end_date) : undefined,
    groupId:
      'group' in event
        ? (event.group?.id ?? undefined)
        : 'group_id' in event
          ? (event.group_id ?? undefined)
          : undefined,
    groupName: 'group' in event ? (event.group?.name ?? undefined) : undefined,
  });

  if (!cardType || !cardProps) {
    return null;
  }

  return (
    <DynamicTimelineCard
      cardType={cardType}
      cardProps={onSelect ? { ...cardProps, onSelect } : cardProps}
    />
  );
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
      <Link to="/event/$id" params={{ id: event.id }} className="inline-flex">
        <span className="truncate">
          {label}: {event.title || translateText('generated.inline.0102_veranstaltung_e6fdb4cc')}
        </span>
      </Link>
    </EntityBadge>
  );
}

function AmendmentTag({ amendment }: { amendment: NonNullable<GroupOpenAssignment['amendment']> }) {
  return (
    <EntityBadge asChild tone="accent" className="max-w-full hover:opacity-90">
      <Link to="/amendment/$id" params={{ id: amendment.id }} className="inline-flex">
        <span className="truncate">{amendment.title}</span>
      </Link>
    </EntityBadge>
  );
}

export function OpenAssignmentsPanel({
  groupId,
  groupName,
  assignments,
  availableEvents,
  isLoading = false,
  isScheduling = false,
  onScheduleRoleRenewal,
  onScheduleDelegateElection,
  onScheduleProcessTask,
}: OpenAssignmentsPanelProps) {
  const { t, i18n } = useTranslation();
  const [selectedEventIds, setSelectedEventIds] = useState<Record<string, string>>({});
  const [delegateDialogAssignmentId, setDelegateDialogAssignmentId] = useState<string | null>(null);
  const [delegateDialogEventId, setDelegateDialogEventId] = useState<string>('');
  const [delegateDialogSearchQuery, setDelegateDialogSearchQuery] = useState('');
  const [delegateDialogCorrelationId, setDelegateDialogCorrelationId] = useState<string | null>(
    null
  );
  const [agendaPreviewAssignmentId, setAgendaPreviewAssignmentId] = useState<string | null>(null);

  const assignmentsWithProgress = useMemo(
    () =>
      assignments.map(assignment => ({
        assignment,
        remainingSeatCount:
          assignment.kind === 'delegate_election' ? getRemainingSeatCount(assignment) : 0,
      })),
    [assignments]
  );

  const activeDelegateAssignment = useMemo(
    () =>
      assignments.find(
        assignment =>
          assignment.kind === 'delegate_election' && assignment.id === delegateDialogAssignmentId
      ) ?? null,
    [assignments, delegateDialogAssignmentId]
  );
  const activeAgendaPreviewAssignment = useMemo(
    () =>
      assignments.find(
        assignment =>
          assignment.kind === 'process_task' && assignment.id === agendaPreviewAssignmentId
      ) ?? null,
    [agendaPreviewAssignmentId, assignments]
  );

  const filteredDelegateDialogEvents = useMemo(() => {
    const normalizedQuery = delegateDialogSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return availableEvents;
    }

    return availableEvents.filter(event =>
      [event.title].filter(Boolean).some(value => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [availableEvents, delegateDialogSearchQuery]);

  const openDelegateDialog = (assignment: GroupOpenAssignment) => {
    const correlationId = createElectionFlowCorrelationId('delegate-assignment-search');
    setDelegateDialogAssignmentId(assignment.id);
    setDelegateDialogEventId(getDefaultEventId(assignment, availableEvents, selectedEventIds));
    setDelegateDialogSearchQuery('');
    setDelegateDialogCorrelationId(correlationId);

    logElectionFlowClient('delegate-assignment-search', 'dialog-opened', {
      correlationId,
      assignmentId: assignment.id,
      targetEventId: assignment.targetEvent?.id ?? null,
      targetEventTitle: assignment.targetEvent?.title ?? null,
      remainingSeatCount: getRemainingSeatCount(assignment),
    });
  };

  const closeDelegateDialog = (open: boolean) => {
    if (open) {
      return;
    }

    setDelegateDialogAssignmentId(null);
    setDelegateDialogEventId('');
    setDelegateDialogSearchQuery('');
    setDelegateDialogCorrelationId(null);
  };

  const handleCreateDelegateElection = async () => {
    if (!activeDelegateAssignment || !delegateDialogEventId) {
      return;
    }

    logElectionFlowClient('delegate-assignment-search', 'create-clicked', {
      correlationId: delegateDialogCorrelationId,
      assignmentId: activeDelegateAssignment.id,
      selectedEventId: delegateDialogEventId,
      mode: normalizeDelegateElectionMode(
        activeDelegateAssignment.targetEvent?.delegate_election_mode
      ),
    });

    await onScheduleDelegateElection(
      activeDelegateAssignment,
      delegateDialogEventId,
      normalizeDelegateElectionMode(activeDelegateAssignment.targetEvent?.delegate_election_mode)
    );

    closeDelegateDialog(false);
  };

  const isAmendmentProcessAssignment = (assignment: GroupOpenAssignment) =>
    assignment.kind === 'process_task' &&
    assignment.processTaskType !== 'implementation_evaluation' &&
    assignment.processTaskType !== 'support_confirmation' &&
    Boolean(assignment.amendment?.id);

  const assignmentColumns: ColumnDef<OpenAssignmentTableRow>[] = [
    {
      id: 'assignment',
      header: t('features.groups.memberships.openAssignments.columns.assignment'),
      cell: ({ row }) => {
        const { assignment, remainingSeatCount } = row.original;
        const dueAtLabel = formatDateTime(assignment.dueAt, i18n.language);

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
                <p className="text-muted-foreground text-sm">{assignment.description}</p>
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
                  search={
                    assignment.kind === 'process_task' && assignment.processTaskId
                      ? buildCreateEventSearchFromProcessTask({
                          task: {
                            id: assignment.processTaskId,
                            group_id: groupId,
                            process_run_id: assignment.processRunId ?? null,
                            step_run_id: assignment.stepRunId ?? null,
                            due_at: assignment.dueAt ?? null,
                            metadata: assignment.processTaskMetadata,
                          },
                          groupId,
                          returnTo: `/group/${groupId}/memberships?tab=openAssignments`,
                        })
                      : { groupId }
                  }
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

        if (assignment.kind === 'delegate_election') {
          return (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                {t('features.groups.memberships.openAssignments.delegateElectionHelp', {
                  groupName:
                    groupName || t('features.groups.memberships.openAssignments.thisGroup'),
                  defaultValue:
                    'Delegates must be elected at an upcoming or ongoing event for {{groupName}}.',
                })}
              </p>
              <Button
                className="w-full justify-center"
                disabled={isScheduling}
                onClick={() => openDelegateDialog(assignment)}
              >
                <Search className="mr-2 h-4 w-4" />
                {t('features.groups.memberships.openAssignments.searchDelegateElectionEvent')}
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
                  onClick={() =>
                    void (assignment.kind === 'process_task'
                      ? onScheduleProcessTask(assignment, selectedEventId)
                      : onScheduleRoleRenewal(assignment, selectedEventId))
                  }
                >
                  <CalendarPlus2 className="mr-2 h-4 w-4" />
                  {assignment.kind === 'process_task'
                    ? assignment.processTaskType === 'implementation_evaluation'
                      ? t(
                          'features.groups.memberships.openAssignments.scheduleImplementationReview'
                        )
                      : assignment.processTaskType === 'support_confirmation'
                        ? t('features.groups.memberships.openAssignments.scheduleConfirmation')
                        : t('features.groups.memberships.openAssignments.attachToEvent')
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('features.groups.memberships.openAssignments.title')}</CardTitle>
          <CardDescription>
            {t('features.groups.memberships.openAssignments.loadingDescription')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card surface="subtleGradient">
        <CardHeader>
          <CardTitle>{t('features.groups.memberships.openAssignments.title')}</CardTitle>
          <CardDescription>
            {t('features.groups.memberships.openAssignments.emptyDescription')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card surface="subtleGradient">
        <CardHeader>
          <CardTitle>
            {t('features.groups.memberships.openAssignments.titleWithCount', {
              count: assignments.length,
              defaultValue: 'Open Assignments ({{count}})',
            })}
          </CardTitle>
          <CardDescription>
            {t('features.groups.memberships.openAssignments.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={assignmentColumns}
            data={assignmentsWithProgress}
            getRowId={row => row.assignment.id}
            enablePagination={false}
          />
        </CardContent>
      </Card>

      <Dialog open={!!activeDelegateAssignment} onOpenChange={closeDelegateDialog}>
        <ScrollableDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {t('features.groups.memberships.openAssignments.delegateDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('features.groups.memberships.openAssignments.delegateDialog.description', {
                groupName: groupName || t('features.groups.memberships.openAssignments.thisGroup'),
                defaultValue:
                  'Choose an upcoming or ongoing event for {{groupName}} where the delegate election should be created.',
              })}
            </DialogDescription>
          </DialogHeader>

          {activeDelegateAssignment ? (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="delegate-mode" tone="neutral">
                    {getElectionModeLabel(
                      normalizeDelegateElectionMode(
                        activeDelegateAssignment.targetEvent?.delegate_election_mode
                      )
                    )}
                  </StatusBadge>
                  <StatusBadge status="open" tone="info">
                    {t(
                      'features.groups.memberships.openAssignments.delegateDialog.remainingSeats',
                      {
                        count: getRemainingSeatCount(activeDelegateAssignment),
                        defaultValue: '{{count}} delegates to elect',
                      }
                    )}
                  </StatusBadge>
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  {t('features.groups.memberships.openAssignments.delegateDialog.targetEvent')}
                </p>
                <div className="mt-3">
                  {activeDelegateAssignment.targetEvent
                    ? buildEventCard(activeDelegateAssignment.targetEvent)
                    : null}
                </div>
              </div>

              <div className="space-y-2">
                <FormControlLabel>
                  {t('features.groups.memberships.openAssignments.delegateDialog.searchLabel')}
                </FormControlLabel>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <FormControlInput
                    value={delegateDialogSearchQuery}
                    onChange={event => {
                      const nextValue = event.target.value;
                      setDelegateDialogSearchQuery(nextValue);
                      logElectionFlowClient('delegate-assignment-search', 'search-changed', {
                        correlationId: delegateDialogCorrelationId,
                        assignmentId: activeDelegateAssignment.id,
                        query: nextValue,
                      });
                    }}
                    placeholder={t(
                      'features.groups.memberships.openAssignments.delegateDialog.searchPlaceholder'
                    )}
                    className="pl-9"
                  />
                </div>
              </div>

              {filteredDelegateDialogEvents.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {filteredDelegateDialogEvents.map(event => (
                    <div
                      key={event.id}
                      className={cn(
                        'rounded-2xl border transition-all',
                        delegateDialogEventId === event.id
                          ? featureThemeClassName('groupOpenAssignmentsPanelThemedBorder')
                          : featureThemeClassName('groupOpenAssignmentsPanelThemedBorderAlpha')
                      )}
                    >
                      {buildEventCard(event, () => {
                        setDelegateDialogEventId(event.id);
                        logElectionFlowClient('delegate-assignment-search', 'event-selected', {
                          correlationId: delegateDialogCorrelationId,
                          assignmentId: activeDelegateAssignment.id,
                          selectedEventId: event.id,
                          selectedEventTitle: event.title ?? null,
                        });
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
                  {t('features.groups.memberships.openAssignments.delegateDialog.emptySearch')}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => closeDelegateDialog(false)}>
              {t('features.groups.memberships.openAssignments.delegateDialog.cancel')}
            </Button>
            <Button
              disabled={!delegateDialogEventId || isScheduling}
              onClick={() => void handleCreateDelegateElection()}
            >
              <Vote className="mr-2 h-4 w-4" />
              {t('features.groups.memberships.openAssignments.delegateDialog.create')}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>

      {activeAgendaPreviewAssignment?.amendment?.id ? (
        <ProcessAgendaPreviewDialog
          open={Boolean(activeAgendaPreviewAssignment)}
          onOpenChange={open => {
            if (!open) {
              setAgendaPreviewAssignmentId(null);
            }
          }}
          amendmentId={activeAgendaPreviewAssignment.amendment.id}
          amendmentTitle={activeAgendaPreviewAssignment.amendment.title}
          processRunId={activeAgendaPreviewAssignment.processRunId}
          focusStepRunId={activeAgendaPreviewAssignment.stepRunId}
        />
      ) : null}
    </>
  );
}

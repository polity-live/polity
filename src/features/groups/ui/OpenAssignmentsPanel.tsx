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
import { buildCreateEventSearchFromProcessTask } from '@/features/amendments/logic/processTaskEventScheduling';
import {
  createElectionFlowCorrelationId,
  logElectionFlowClient,
} from '@/features/elections/logic/electionFlowLogging';
import {
  getRemainingSeatCount,
  type GroupOpenAssignment,
} from '@/features/groups/logic/openAssignments';
import { DynamicTimelineCard } from '@/features/timeline/ui/LazyCardComponents';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { TableTag } from '@/features/shared/ui/ui/table-tag';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { cn } from '@/features/shared/utils/utils';
import { ProcessAgendaPreviewDialog } from '@/features/groups/ui/ProcessAgendaPreviewDialog';
import type { DelegateElectionMode } from '../hooks/useGroupOpenAssignments';

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

function getStatusBadge(t: TFunction, assignment: GroupOpenAssignment) {
  switch (assignment.status) {
    case 'completed':
      return (
        <Badge className="bg-emerald-600 text-white">
          {t('features.groups.memberships.openAssignments.status.completed', 'Completed')}
        </Badge>
      );
    case 'scheduled':
      return (
        <Badge variant="secondary">
          {t('features.groups.memberships.openAssignments.status.scheduled', 'Scheduled')}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {t('features.groups.memberships.openAssignments.status.open', 'Open')}
        </Badge>
      );
  }
}

function getAssignmentTypeBadge(t: TFunction, assignment: GroupOpenAssignment) {
  switch (assignment.kind) {
    case 'delegate_election':
      return (
        <Badge>
          {t(
            'features.groups.memberships.openAssignments.type.delegateElection',
            'Delegate election'
          )}
        </Badge>
      );
    case 'role_renewal':
      return (
        <Badge variant="secondary">
          {t('features.groups.memberships.openAssignments.type.roleRenewal', 'Role renewal')}
        </Badge>
      );
    case 'process_task':
      return (
        <Badge variant="outline">
          {assignment.processTaskType === 'implementation_evaluation'
            ? t(
                'features.groups.memberships.openAssignments.type.implementationEvaluation',
                'Implementation review'
              )
            : assignment.processTaskType === 'support_confirmation'
              ? t(
                  'features.groups.memberships.openAssignments.type.supportConfirmation',
                  'Support confirmation'
                )
              : t(
                  'features.groups.memberships.openAssignments.type.processTask',
                  'Amendment process'
                )}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {t('features.groups.memberships.openAssignments.type.assignment', 'Assignment')}
        </Badge>
      );
  }
}

function getDefaultEventId(
  assignment: GroupOpenAssignment,
  availableEvents: readonly AvailableEventLike[],
  selectedEventIds: Record<string, string>
) {
  return (
    selectedEventIds[assignment.id] || assignment.linkedEvent?.id || availableEvents[0]?.id || ''
  );
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
    <Link to="/event/$id" params={{ id: event.id }} className="inline-flex hover:opacity-90">
      <TableTag entityType="event" className="max-w-full">
        <span className="truncate">
          {label}: {event.title || 'Veranstaltung'}
        </span>
      </TableTag>
    </Link>
  );
}

function AmendmentTag({ amendment }: { amendment: NonNullable<GroupOpenAssignment['amendment']> }) {
  return (
    <Link
      to="/amendment/$id"
      params={{ id: amendment.id }}
      className="inline-flex hover:opacity-90"
    >
      <TableTag entityType="amendment" className="max-w-full">
        <span className="truncate">{amendment.title}</span>
      </TableTag>
    </Link>
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {t('features.groups.memberships.openAssignments.title', 'Open Assignments')}
          </CardTitle>
          <CardDescription>
            {t(
              'features.groups.memberships.openAssignments.loadingDescription',
              "Loading this group's assignments."
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card className="border-border/70 from-background to-muted/20 bg-gradient-to-b">
        <CardHeader>
          <CardTitle>
            {t('features.groups.memberships.openAssignments.title', 'Open Assignments')}
          </CardTitle>
          <CardDescription>
            {t(
              'features.groups.memberships.openAssignments.emptyDescription',
              'There are currently no open election, role, or amendment assignments.'
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/70 from-background to-muted/20 bg-gradient-to-b">
        <CardHeader>
          <CardTitle>
            {t('features.groups.memberships.openAssignments.titleWithCount', {
              count: assignments.length,
              defaultValue: 'Open Assignments ({{count}})',
            })}
          </CardTitle>
          <CardDescription>
            {t(
              'features.groups.memberships.openAssignments.description',
              'Election, role, and amendment assignments for this group in the same table format as the other membership sections.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-border/70 overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t(
                      'features.groups.memberships.openAssignments.columns.assignment',
                      'Assignment'
                    )}
                  </TableHead>
                  <TableHead>
                    {t('features.groups.memberships.openAssignments.columns.type', 'Type')}
                  </TableHead>
                  <TableHead>
                    {t('features.groups.memberships.openAssignments.columns.status', 'Status')}
                  </TableHead>
                  <TableHead>
                    {t(
                      'features.groups.memberships.openAssignments.columns.amendment',
                      'Amendment'
                    )}
                  </TableHead>
                  <TableHead>
                    {t('features.groups.memberships.openAssignments.columns.events', 'Events')}
                  </TableHead>
                  <TableHead className="w-[26rem]">
                    {t('features.groups.memberships.openAssignments.columns.action', 'Action')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentsWithProgress.map(({ assignment, remainingSeatCount }) => {
                  const selectedEventId = getDefaultEventId(
                    assignment,
                    availableEvents,
                    selectedEventIds
                  );
                  const showAgendaPreviewButton = isAmendmentProcessAssignment(assignment);
                  const canScheduleMore =
                    assignment.kind === 'delegate_election'
                      ? remainingSeatCount > 0
                      : assignment.status !== 'completed';
                  const dueAtLabel = formatDateTime(assignment.dueAt, i18n.language);

                  return (
                    <TableRow key={assignment.id}>
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            {assignment.kind === 'delegate_election' ? (
                              <Vote className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            ) : (
                              <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium">{assignment.title}</p>
                              <p className="text-muted-foreground text-sm">
                                {assignment.description}
                              </p>
                            </div>
                          </div>

                          {assignment.kind === 'delegate_election' ? (
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">
                                {t(
                                  'features.groups.memberships.openAssignments.seatCount',
                                  'Seats'
                                )}
                                : {assignment.seatCount ?? 0}
                              </Badge>
                              <Badge variant="outline">
                                {t(
                                  'features.groups.memberships.openAssignments.completedSeatCount',
                                  'Elected'
                                )}
                                : {assignment.completedSeatCount ?? 0}
                              </Badge>
                              <Badge variant="outline">
                                {t(
                                  'features.groups.memberships.openAssignments.scheduledSeatCount',
                                  'Scheduled'
                                )}
                                : {assignment.scheduledSeatCount ?? 0}
                              </Badge>
                              <Badge variant="outline">
                                {t(
                                  'features.groups.memberships.openAssignments.openSeatCount',
                                  'Open'
                                )}
                                : {remainingSeatCount}
                              </Badge>
                              <Badge variant="outline" className="font-normal">
                                {getElectionModeLabel(
                                  normalizeDelegateElectionMode(
                                    assignment.targetEvent?.delegate_election_mode
                                  )
                                )}
                              </Badge>
                            </div>
                          ) : null}

                          {dueAtLabel ? (
                            <p className="text-muted-foreground text-xs">
                              {t('features.groups.memberships.openAssignments.dueAt', 'Due')}:{' '}
                              {dueAtLabel}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        {getAssignmentTypeBadge(t, assignment)}
                      </TableCell>
                      <TableCell className="align-top">{getStatusBadge(t, assignment)}</TableCell>

                      <TableCell className="align-top">
                        {assignment.amendment ? (
                          <div className="flex flex-wrap gap-2">
                            <AmendmentTag amendment={assignment.amendment} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {t(
                              'features.groups.memberships.openAssignments.noAmendment',
                              'No amendment'
                            )}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-2">
                          {assignment.targetEvent?.id ? (
                            <EventTag
                              event={assignment.targetEvent}
                              label={t(
                                'features.groups.memberships.openAssignments.targetEventLabel',
                                'Target'
                              )}
                            />
                          ) : null}
                          {assignment.linkedEvent?.id ? (
                            <EventTag
                              event={assignment.linkedEvent}
                              label={t(
                                'features.groups.memberships.openAssignments.linkedEventLabel',
                                'Linked'
                              )}
                            />
                          ) : null}
                          {!assignment.targetEvent?.id && !assignment.linkedEvent?.id ? (
                            <span className="text-muted-foreground text-sm">
                              {t(
                                'features.groups.memberships.openAssignments.noEventLinked',
                                'No event linked yet'
                              )}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        {!canScheduleMore ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" />
                              {t(
                                'features.groups.memberships.openAssignments.completedBanner',
                                'Fully scheduled or completed'
                              )}
                            </div>
                            {showAgendaPreviewButton ? (
                              <Button
                                variant="outline"
                                className="w-full justify-center"
                                onClick={() => setAgendaPreviewAssignmentId(assignment.id)}
                              >
                                {t(
                                  'features.groups.memberships.openAssignments.showAgendaItems',
                                  'Show new agenda items'
                                )}
                              </Button>
                            ) : null}
                          </div>
                        ) : availableEvents.length === 0 ? (
                          <div className="space-y-3 rounded-lg border border-dashed p-3">
                            <p className="text-muted-foreground text-sm">
                              {t(
                                'features.groups.memberships.openAssignments.noEligibleEventsForGroup',
                                {
                                  groupName:
                                    groupName ||
                                    t(
                                      'features.groups.memberships.openAssignments.thisGroup',
                                      'this group'
                                    ),
                                  defaultValue:
                                    'There is currently no upcoming or ongoing event for {{groupName}}.',
                                }
                              )}
                            </p>
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
                                {t(
                                  'features.groups.memberships.openAssignments.createEvent',
                                  'Create event'
                                )}
                              </Link>
                            </Button>
                            {showAgendaPreviewButton ? (
                              <Button
                                variant="outline"
                                className="w-full justify-center"
                                onClick={() => setAgendaPreviewAssignmentId(assignment.id)}
                              >
                                {t(
                                  'features.groups.memberships.openAssignments.showAgendaItems',
                                  'Show new agenda items'
                                )}
                              </Button>
                            ) : null}
                          </div>
                        ) : assignment.kind === 'delegate_election' ? (
                          <div className="space-y-2">
                            <p className="text-muted-foreground text-sm">
                              {t(
                                'features.groups.memberships.openAssignments.delegateElectionHelp',
                                {
                                  groupName:
                                    groupName ||
                                    t(
                                      'features.groups.memberships.openAssignments.thisGroup',
                                      'this group'
                                    ),
                                  defaultValue:
                                    'Delegates must be elected at an upcoming or ongoing event for {{groupName}}.',
                                }
                              )}
                            </p>
                            <Button
                              className="w-full justify-center"
                              disabled={isScheduling}
                              onClick={() => openDelegateDialog(assignment)}
                            >
                              <Search className="mr-2 h-4 w-4" />
                              {t(
                                'features.groups.memberships.openAssignments.searchDelegateElectionEvent',
                                'Find event for delegate election'
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                              <div className="space-y-2">
                                <Label className="text-xs">
                                  {t(
                                    'features.groups.memberships.openAssignments.selectEventLabel',
                                    'Which event should this assignment be attached to?'
                                  )}
                                </Label>
                                <Select
                                  value={selectedEventId}
                                  onValueChange={value =>
                                    setSelectedEventIds(current => ({
                                      ...current,
                                      [assignment.id]: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={t(
                                        'features.groups.memberships.openAssignments.selectEventPlaceholder',
                                        'Select event'
                                      )}
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableEvents.map(event => (
                                      <SelectItem key={event.id} value={event.id}>
                                        {event.title ||
                                          t(
                                            'features.groups.memberships.openAssignments.eventFallback',
                                            'Event'
                                          )}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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
                                          'features.groups.memberships.openAssignments.scheduleImplementationReview',
                                          'Schedule review'
                                        )
                                      : assignment.processTaskType === 'support_confirmation'
                                        ? t(
                                            'features.groups.memberships.openAssignments.scheduleConfirmation',
                                            'Schedule confirmation'
                                          )
                                        : t(
                                            'features.groups.memberships.openAssignments.attachToEvent',
                                            'Attach to event'
                                          )
                                    : t(
                                        'features.groups.memberships.openAssignments.attachToEvent',
                                        'Attach to event'
                                      )}
                                </Button>
                              </div>
                            </div>

                            {showAgendaPreviewButton ? (
                              <Button
                                variant="outline"
                                className="w-full justify-center"
                                onClick={() => setAgendaPreviewAssignmentId(assignment.id)}
                              >
                                {t(
                                  'features.groups.memberships.openAssignments.showAgendaItems',
                                  'Show new agenda items'
                                )}
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!activeDelegateAssignment} onOpenChange={closeDelegateDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {t(
                'features.groups.memberships.openAssignments.delegateDialog.title',
                'Find election event for delegate assignment'
              )}
            </DialogTitle>
            <DialogDescription>
              {t('features.groups.memberships.openAssignments.delegateDialog.description', {
                groupName:
                  groupName ||
                  t('features.groups.memberships.openAssignments.thisGroup', 'this group'),
                defaultValue:
                  'Choose an upcoming or ongoing event for {{groupName}} where the delegate election should be created.',
              })}
            </DialogDescription>
          </DialogHeader>

          {activeDelegateAssignment ? (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {getElectionModeLabel(
                      normalizeDelegateElectionMode(
                        activeDelegateAssignment.targetEvent?.delegate_election_mode
                      )
                    )}
                  </Badge>
                  <Badge variant="secondary">
                    {t(
                      'features.groups.memberships.openAssignments.delegateDialog.remainingSeats',
                      {
                        count: getRemainingSeatCount(activeDelegateAssignment),
                        defaultValue: '{{count}} delegates to elect',
                      }
                    )}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  {t(
                    'features.groups.memberships.openAssignments.delegateDialog.targetEvent',
                    'Target event for the delegate election:'
                  )}
                </p>
                <div className="mt-3">
                  {activeDelegateAssignment.targetEvent
                    ? buildEventCard(activeDelegateAssignment.targetEvent)
                    : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {t(
                    'features.groups.memberships.openAssignments.delegateDialog.searchLabel',
                    'Search upcoming or ongoing events'
                  )}
                </Label>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
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
                      'features.groups.memberships.openAssignments.delegateDialog.searchPlaceholder',
                      'Search by title'
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
                          ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]'
                          : 'border-transparent'
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
                  {t(
                    'features.groups.memberships.openAssignments.delegateDialog.emptySearch',
                    'No upcoming or ongoing events were found for the current search.'
                  )}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => closeDelegateDialog(false)}>
              {t('features.groups.memberships.openAssignments.delegateDialog.cancel', 'Cancel')}
            </Button>
            <Button
              disabled={!delegateDialogEventId || isScheduling}
              onClick={() => void handleCreateDelegateElection()}
            >
              <Vote className="mr-2 h-4 w-4" />
              {t(
                'features.groups.memberships.openAssignments.delegateDialog.create',
                'Create election'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
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

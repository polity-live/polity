import { useMemo, useState } from 'react';
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
import { cn } from '@/features/shared/utils/utils';
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

function getStatusBadge(assignment: GroupOpenAssignment) {
  switch (assignment.status) {
    case 'completed':
      return <Badge className="bg-emerald-600 text-white">Erledigt</Badge>;
    case 'scheduled':
      return <Badge variant="secondary">Geplant</Badge>;
    default:
      return <Badge variant="outline">Offen</Badge>;
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
  const [selectedEventIds, setSelectedEventIds] = useState<Record<string, string>>({});
  const [delegateDialogAssignmentId, setDelegateDialogAssignmentId] = useState<string | null>(null);
  const [delegateDialogEventId, setDelegateDialogEventId] = useState<string>('');
  const [delegateDialogSearchQuery, setDelegateDialogSearchQuery] = useState('');
  const [delegateDialogCorrelationId, setDelegateDialogCorrelationId] = useState<string | null>(
    null
  );

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Offene Auftraege</CardTitle>
          <CardDescription>Die Auftraege dieser Gruppe werden geladen.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Offene Auftraege</CardTitle>
          <CardDescription>
            Aktuell gibt es keine offenen Wahl- oder Delegiertenauftraege.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {assignmentsWithProgress.map(({ assignment, remainingSeatCount }) => {
          const selectedEventId = getDefaultEventId(assignment, availableEvents, selectedEventIds);
          const canScheduleMore =
            assignment.kind === 'delegate_election'
              ? remainingSeatCount > 0
              : assignment.status !== 'completed';

          return (
            <Card key={assignment.id}>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {assignment.kind === 'delegate_election' ? (
                        <Vote className="h-5 w-5" />
                      ) : (
                        <Clock3 className="h-5 w-5" />
                      )}
                      {assignment.title}
                    </CardTitle>
                    <CardDescription>{assignment.description}</CardDescription>
                  </div>
                  {getStatusBadge(assignment)}
                </div>

                {assignment.kind === 'delegate_election' ? (
                  <div className="text-muted-foreground flex flex-wrap gap-2 text-sm">
                    <span>
                      Sitze gesamt: <strong>{assignment.seatCount ?? 0}</strong>
                    </span>
                    <span>
                      bereits gewaehlt: <strong>{assignment.completedSeatCount ?? 0}</strong>
                    </span>
                    <span>
                      an Events angehaengt: <strong>{assignment.scheduledSeatCount ?? 0}</strong>
                    </span>
                    <span>
                      offen: <strong>{remainingSeatCount}</strong>
                    </span>
                    <Badge variant="outline" className="font-normal">
                      {getElectionModeLabel(
                        normalizeDelegateElectionMode(
                          assignment.targetEvent?.delegate_election_mode
                        )
                      )}
                    </Badge>
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {assignment.targetEvent?.id ? (
                    <div className="space-y-2">
                      <Label>Ziel-Event</Label>
                      {buildEventCard(assignment.targetEvent)}
                    </div>
                  ) : null}

                  {assignment.linkedEvent?.id ? (
                    <div className="space-y-2">
                      <Label>Verknuepfte Veranstaltung</Label>
                      {buildEventCard(assignment.linkedEvent)}
                    </div>
                  ) : null}
                </div>

                {canScheduleMore ? (
                  availableEvents.length > 0 ? (
                    assignment.kind === 'delegate_election' ? (
                      <div className="rounded-2xl border border-dashed p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Die Delegierten muessen auf einem anstehenden oder laufenden Event von{' '}
                              {groupName || 'dieser Gruppe'} gewaehlt werden.
                            </p>
                            <p className="text-muted-foreground text-sm">
                              Fuer diesen Auftrag werden aktuell {remainingSeatCount}{' '}
                              {remainingSeatCount === 1 ? 'Delegierte' : 'Delegierte'} benoetigt.
                            </p>
                          </div>
                          <Button
                            disabled={isScheduling}
                            onClick={() => openDelegateDialog(assignment)}
                          >
                            <Search className="mr-2 h-4 w-4" />
                            Suche Event fuer die Wahl der Delegierten
                          </Button>
                        </div>
                      </div>
                    ) : assignment.kind === 'process_task' ? (
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="space-y-2">
                          <Label>An welche Veranstaltung soll der Auftrag gehaengt werden?</Label>
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
                              <SelectValue placeholder="Veranstaltung auswaehlen" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableEvents.map(event => (
                                <SelectItem key={event.id} value={event.id}>
                                  {event.title || 'Veranstaltung'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-end">
                          <Button
                            className="w-full"
                            disabled={!selectedEventId || isScheduling}
                            onClick={() => void onScheduleProcessTask(assignment, selectedEventId)}
                          >
                            <CalendarPlus2 className="mr-2 h-4 w-4" />
                            {assignment.processTaskType === 'implementation_evaluation'
                              ? 'Review planen'
                              : assignment.processTaskType === 'support_confirmation'
                                ? 'Bestaetigung planen'
                                : 'An Event anhaengen'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="space-y-2">
                          <Label>An welche Veranstaltung soll der Auftrag gehaengt werden?</Label>
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
                              <SelectValue placeholder="Veranstaltung auswaehlen" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableEvents.map(event => (
                                <SelectItem key={event.id} value={event.id}>
                                  {event.title || 'Veranstaltung'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-end">
                          <Button
                            className="w-full"
                            disabled={!selectedEventId || isScheduling}
                            onClick={() => void onScheduleRoleRenewal(assignment, selectedEventId)}
                          >
                            <CalendarPlus2 className="mr-2 h-4 w-4" />
                            An Event anhaengen
                          </Button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                      Fuer {groupName || 'diese Gruppe'} gibt es gerade kein anstehendes oder
                      laufendes Event, an das der Auftrag gehaengt werden kann.
                      <div className="mt-3">
                        <Button asChild variant="outline">
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
                                    returnTo: `/group/${groupId}?tab=assignments`,
                                  })
                                : { groupId }
                            }
                          >
                            <CalendarPlus2 className="mr-2 h-4 w-4" />
                            Veranstaltung erstellen
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Dieser Auftrag ist aktuell vollstaendig geplant oder bereits abgeschlossen.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!activeDelegateAssignment} onOpenChange={closeDelegateDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Wahl-Event fuer Delegiertenauftrag suchen</DialogTitle>
            <DialogDescription>
              Waehle ein anstehendes oder laufendes Event von {groupName || 'dieser Gruppe'}
              aus, auf dem die Delegiertenwahl angelegt werden soll.
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
                    {getRemainingSeatCount(activeDelegateAssignment)} Delegierte zu waehlen
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  Ziel-Event der Delegiertenwahl:
                </p>
                <div className="mt-3">
                  {activeDelegateAssignment.targetEvent
                    ? buildEventCard(activeDelegateAssignment.targetEvent)
                    : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Suche anstehende oder laufende Events</Label>
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
                    placeholder="Suche nach Titel"
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
                  Fuer die aktuelle Suche wurden keine anstehenden oder laufenden Events gefunden.
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => closeDelegateDialog(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={!delegateDialogEventId || isScheduling}
              onClick={() => void handleCreateDelegateElection()}
            >
              <Vote className="mr-2 h-4 w-4" />
              Wahl erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

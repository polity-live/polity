import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { Search, Vote } from 'lucide-react';
import { buildTimelineCardProps } from '@/features/search/logic/buildTimelineCardProps';
import {
  getElectionModeLabel,
  normalizeDelegateElectionMode,
} from '@/features/elections/logic/electionMode';
import { logElectionFlowClient } from '@/features/elections/logic/electionFlowLogging';
import {
  getRemainingSeatCount,
  type GroupOpenAssignment,
} from '@/features/groups/logic/openAssignments';
import { DynamicTimelineCard } from '@/features/timeline/ui/LazyCardComponents';
import { DataTable } from '@/features/shared/ui/data-table';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { StatusBadge } from '@/features/shared/ui/status';
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
interface AvailableEventLike {
  id: string;
  title?: string | null;
  status?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  group_id?: string | null;
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
export interface OpenAssignmentsPanelViewProps {
  groupId: any;
  groupName: any;
  assignments: any;
  availableEvents: any;
  isLoading: any;
  isScheduling: any;
  focusAssignmentId?: string;
  onScheduleRoleRenewal: any;
  onScheduleDelegateElection: any;
  onScheduleProcessTask: any;
  t: any;
  i18n: any;
  selectedEventIds: any;
  setSelectedEventIds: any;
  eventDialogAssignmentId: any;
  setEventDialogAssignmentId: any;
  eventDialogEventId: any;
  setEventDialogEventId: any;
  eventDialogSearchQuery: any;
  setEventDialogSearchQuery: any;
  eventDialogCorrelationId: any;
  setEventDialogCorrelationId: any;
  agendaPreviewAssignmentId: any;
  setAgendaPreviewAssignmentId: any;
  filteredAssignmentsWithProgress: any;
  assignmentFilters: any;
  activeEventAssignment: any;
  activeAgendaPreviewAssignment: any;
  filteredEventDialogEvents: any;
  openEventDialog: any;
  closeEventDialog: any;
  handleCreateAssignmentElection: any;
  isAmendmentProcessAssignment: any;
  assignmentColumns: any;
}

export function OpenAssignmentsPanelView({
  groupName,
  assignments,
  isLoading,
  isScheduling,
  focusAssignmentId,
  t,
  eventDialogEventId,
  setEventDialogEventId,
  eventDialogSearchQuery,
  setEventDialogSearchQuery,
  eventDialogCorrelationId,
  setAgendaPreviewAssignmentId,
  filteredAssignmentsWithProgress,
  assignmentFilters,
  activeEventAssignment,
  activeAgendaPreviewAssignment,
  filteredEventDialogEvents,
  closeEventDialog,
  handleCreateAssignmentElection,
  assignmentColumns,
}: OpenAssignmentsPanelViewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('features.groups.memberships.openAssignments.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SectionSkeleton rows={3} />
        </CardContent>
      </Card>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card>
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
      <section className="space-y-3">
        <div className="space-y-1.5 px-3 sm:px-4">
          <h2 className="text-base leading-none font-semibold">
            {t('features.groups.memberships.openAssignments.titleWithCount', {
              count: filteredAssignmentsWithProgress.length,
              defaultValue: 'Open Assignments ({{count}})',
            })}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('features.groups.memberships.openAssignments.description')}
          </p>
        </div>
        <DataTable
          columns={assignmentColumns}
          data={filteredAssignmentsWithProgress}
          getRowId={(row: any) => row.assignment.id}
          toolbar={assignmentFilters}
          emptyState={{
            title: t('features.groups.memberships.openAssignments.filters.emptyTitle'),
            description: t('features.groups.memberships.openAssignments.filters.emptyDescription'),
          }}
          rowTestId={(row: any) => `open-assignment-${row.assignment.id}`}
          getRowClassName={(row: any) =>
            row.assignment.id === focusAssignmentId
              ? 'bg-[var(--badge-info-bg)] ring-1 ring-inset ring-[var(--badge-info-border)]'
              : undefined
          }
          enablePagination={false}
        />
      </section>

      <Dialog open={!!activeEventAssignment} onOpenChange={closeEventDialog}>
        <ScrollableDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {activeEventAssignment?.kind === 'role_renewal'
                ? t('features.groups.memberships.openAssignments.roleRenewalDialog.title')
                : t('features.groups.memberships.openAssignments.delegateDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {activeEventAssignment?.kind === 'role_renewal'
                ? t('features.groups.memberships.openAssignments.roleRenewalDialog.description', {
                    groupName:
                      groupName || t('features.groups.memberships.openAssignments.thisGroup'),
                    defaultValue:
                      'Choose an upcoming or ongoing event where this role election should be created.',
                  })
                : t('features.groups.memberships.openAssignments.delegateDialog.description', {
                    groupName:
                      groupName || t('features.groups.memberships.openAssignments.thisGroup'),
                    defaultValue:
                      'Choose an upcoming or ongoing event for {{groupName}} where the delegate election should be created.',
                  })}
            </DialogDescription>
          </DialogHeader>

          {activeEventAssignment ? (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {activeEventAssignment.kind === 'delegate_election' ? (
                    <>
                      <StatusBadge status="delegate-mode" tone="neutral">
                        {getElectionModeLabel(
                          normalizeDelegateElectionMode(
                            activeEventAssignment.targetEvent?.delegate_election_mode
                          )
                        )}
                      </StatusBadge>
                      <StatusBadge status="open" tone="info">
                        {t(
                          'features.groups.memberships.openAssignments.delegateDialog.remainingSeats',
                          {
                            count: getRemainingSeatCount(activeEventAssignment),
                            defaultValue: '{{count}} delegates to elect',
                          }
                        )}
                      </StatusBadge>
                    </>
                  ) : (
                    <StatusBadge status="role-renewal" tone="warning">
                      {t('features.groups.memberships.openAssignments.type.roleRenewal')}
                    </StatusBadge>
                  )}
                </div>
                {activeEventAssignment.kind === 'delegate_election' ? (
                  <>
                    <p className="text-muted-foreground mt-3 text-sm">
                      {t('features.groups.memberships.openAssignments.delegateDialog.targetEvent')}
                    </p>
                    <div className="mt-3">
                      {activeEventAssignment.targetEvent
                        ? buildEventCard(activeEventAssignment.targetEvent)
                        : null}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground mt-3 text-sm">
                    {activeEventAssignment.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <FormControlLabel>
                  {activeEventAssignment.kind === 'role_renewal'
                    ? t('features.groups.memberships.openAssignments.roleRenewalDialog.searchLabel')
                    : t('features.groups.memberships.openAssignments.delegateDialog.searchLabel')}
                </FormControlLabel>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <FormControlInput
                    value={eventDialogSearchQuery}
                    onChange={event => {
                      const nextValue = event.target.value;
                      setEventDialogSearchQuery(nextValue);
                      logElectionFlowClient(
                        activeEventAssignment.kind === 'role_renewal'
                          ? 'role-renewal-assignment-search'
                          : 'delegate-assignment-search',
                        'search-changed',
                        {
                          correlationId: eventDialogCorrelationId,
                          assignmentId: activeEventAssignment.id,
                          assignmentKind: activeEventAssignment.kind,
                          query: nextValue,
                        }
                      );
                    }}
                    placeholder={
                      activeEventAssignment.kind === 'role_renewal'
                        ? t(
                            'features.groups.memberships.openAssignments.roleRenewalDialog.searchPlaceholder'
                          )
                        : t(
                            'features.groups.memberships.openAssignments.delegateDialog.searchPlaceholder'
                          )
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              {filteredEventDialogEvents.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {filteredEventDialogEvents.map((event: any) => (
                    <div
                      key={event.id}
                      className={cn(
                        'rounded-2xl border transition-all',
                        eventDialogEventId === event.id
                          ? featureThemeClassName('groupOpenAssignmentsPanelThemedBorder')
                          : featureThemeClassName('groupOpenAssignmentsPanelThemedBorderAlpha')
                      )}
                    >
                      {buildEventCard(event, () => {
                        setEventDialogEventId(event.id);
                        logElectionFlowClient(
                          activeEventAssignment.kind === 'role_renewal'
                            ? 'role-renewal-assignment-search'
                            : 'delegate-assignment-search',
                          'event-selected',
                          {
                            correlationId: eventDialogCorrelationId,
                            assignmentId: activeEventAssignment.id,
                            assignmentKind: activeEventAssignment.kind,
                            selectedEventId: event.id,
                            selectedEventTitle: event.title ?? null,
                          }
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
                  {activeEventAssignment.kind === 'role_renewal'
                    ? t('features.groups.memberships.openAssignments.roleRenewalDialog.emptySearch')
                    : t('features.groups.memberships.openAssignments.delegateDialog.emptySearch')}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => closeEventDialog(false)}>
              {activeEventAssignment?.kind === 'role_renewal'
                ? t('features.groups.memberships.openAssignments.roleRenewalDialog.cancel')
                : t('features.groups.memberships.openAssignments.delegateDialog.cancel')}
            </Button>
            <Button
              disabled={!eventDialogEventId || isScheduling}
              onClick={() => void handleCreateAssignmentElection()}
            >
              <Vote className="mr-2 h-4 w-4" />
              {activeEventAssignment?.kind === 'role_renewal'
                ? t('features.groups.memberships.openAssignments.roleRenewalDialog.create')
                : t('features.groups.memberships.openAssignments.delegateDialog.create')}
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

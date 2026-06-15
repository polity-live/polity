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
import { StatusBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
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
  onScheduleRoleRenewal: any;
  onScheduleDelegateElection: any;
  onScheduleProcessTask: any;
  t: any;
  i18n: any;
  selectedEventIds: any;
  setSelectedEventIds: any;
  delegateDialogAssignmentId: any;
  setDelegateDialogAssignmentId: any;
  delegateDialogEventId: any;
  setDelegateDialogEventId: any;
  delegateDialogSearchQuery: any;
  setDelegateDialogSearchQuery: any;
  delegateDialogCorrelationId: any;
  setDelegateDialogCorrelationId: any;
  agendaPreviewAssignmentId: any;
  setAgendaPreviewAssignmentId: any;
  assignmentsWithProgress: any;
  activeDelegateAssignment: any;
  activeAgendaPreviewAssignment: any;
  filteredDelegateDialogEvents: any;
  openDelegateDialog: any;
  closeDelegateDialog: any;
  handleCreateDelegateElection: any;
  isAmendmentProcessAssignment: any;
  assignmentColumns: any;
}

export function OpenAssignmentsPanelView({
  groupName,
  assignments,
  isLoading,
  isScheduling,
  t,
  delegateDialogEventId,
  setDelegateDialogEventId,
  delegateDialogSearchQuery,
  setDelegateDialogSearchQuery,
  delegateDialogCorrelationId,
  setAgendaPreviewAssignmentId,
  assignmentsWithProgress,
  activeDelegateAssignment,
  activeAgendaPreviewAssignment,
  filteredDelegateDialogEvents,
  closeDelegateDialog,
  handleCreateDelegateElection,
  assignmentColumns,
}: OpenAssignmentsPanelViewProps) {
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
              count: assignments.length,
              defaultValue: 'Open Assignments ({{count}})',
            })}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('features.groups.memberships.openAssignments.description')}
          </p>
        </div>
        <DataTable
          columns={assignmentColumns}
          data={assignmentsWithProgress}
          getRowId={(row: any) => row.assignment.id}
          enablePagination={false}
        />
      </section>

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
                  {filteredDelegateDialogEvents.map((event: any) => (
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

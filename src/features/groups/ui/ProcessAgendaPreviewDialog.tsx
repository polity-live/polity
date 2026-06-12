import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import {
  AgendaCard,
  type AgendaItemStatus,
  type AgendaItemType,
} from '@/features/agendas/ui/AgendaCard';
import { TimelineItem } from '@/features/agendas/ui/TimelineItem';
import { getAgendaDisplayTimes } from '@/features/agendas/logic/getAgendaDisplayTimes';
import { getAgendaRuntimeStatus } from '@/features/agendas/logic/getAgendaRuntimeStatus';
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
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';

interface ProcessAgendaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amendmentId: string;
  amendmentTitle?: string | null;
  processRunId?: string | null;
  focusStepRunId?: string | null;
}

interface PreviewItem {
  id: string;
  title: string;
  description?: string;
  subtitle: string;
  detailsLink: string;
  type: AgendaItemType;
  status: AgendaItemStatus;
  state: 'scheduled' | 'scheduled_but_not_confirmed';
  order: number;
  duration: number;
  displayStartTime?: number;
  displayEndTime?: number;
}

interface StepRunLike {
  id: string;
  step_kind?: string | null;
  status?: string | null;
  decision_status?: string | null;
  order_index: number;
  starts_at?: number | null;
  support_confirmation_id?: string | null;
  event?: {
    id?: string | null;
    title?: string | null;
    start_date?: number | null;
    end_date?: number | null;
  } | null;
  agenda_item?: {
    id?: string | null;
    title?: string | null;
    description?: string | null;
    type?: string | null;
    status?: string | null;
    forwarding_status?: string | null;
    duration?: number | null;
    start_time?: number | null;
    end_time?: number | null;
    activated_at?: number | null;
    completed_at?: number | null;
  } | null;
  target_group?: {
    name?: string | null;
  } | null;
  workflow_step?: {
    label?: string | null;
  } | null;
}

function isTerminalStatus(status?: string | null) {
  return ['approved', 'rejected', 'merged', 'withdrawn', 'completed'].includes(status ?? '');
}

function formatTime(value?: number | Date | null) {
  if (!value) {
    return '--:--';
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAgendaDisplayType(step: {
  agendaItemType?: string | null;
  stepKind?: string | null;
  supportConfirmationId?: string | null;
}): AgendaItemType {
  if (step.supportConfirmationId) {
    return 'vote';
  }

  if (step.stepKind === 'merge_vote') {
    return 'vote';
  }

  if (
    step.agendaItemType === 'election' ||
    step.agendaItemType === 'vote' ||
    step.agendaItemType === 'speech' ||
    step.agendaItemType === 'discussion' ||
    step.agendaItemType === 'accreditation'
  ) {
    return step.agendaItemType;
  }

  if (step.agendaItemType === 'amendment') {
    return 'vote';
  }

  return 'discussion';
}

function buildFallbackAgendaTitle(
  step: {
    step_kind?: string | null;
    support_confirmation_id?: string | null;
  },
  resolvedAmendmentTitle: string
) {
  if (step.support_confirmation_id) {
    return `Support confirmation: ${resolvedAmendmentTitle}`;
  }

  if (step.step_kind === 'merge_vote') {
    return `Merge confirmation: ${resolvedAmendmentTitle}`;
  }

  return `Amendment: ${resolvedAmendmentTitle}`;
}

function buildStepTargetGroupName(step: StepRunLike, fallbackTargetGroupName: string) {
  const targetGroupName =
    'target_group' in step && step.target_group && 'name' in step.target_group
      ? step.target_group.name
      : null;
  const workflowLabel =
    'workflow_step' in step && step.workflow_step && 'label' in step.workflow_step
      ? step.workflow_step.label
      : null;

  return targetGroupName || workflowLabel || fallbackTargetGroupName;
}

function buildPreviewDescription(args: {
  step: StepRunLike;
  isPredicted: boolean;
  state: PreviewItem['state'];
  targetGroupName: string;
}) {
  const agendaDescription = args.step.agenda_item?.description?.trim();
  if (agendaDescription) {
    return agendaDescription;
  }

  if (args.isPredicted) {
    return `Dieses Agenda item wird automatisch erstellt, sobald fuer ${args.targetGroupName} ein passendes Event angelegt oder verknuepft wird.`;
  }

  if (args.state === 'scheduled_but_not_confirmed') {
    return 'Die darunter liegende Abstimmung ist noch ausstehend. Dieses Agenda item bleibt deshalb vorerst nur vorgeplant.';
  }

  return 'Die darunter liegende Abstimmung wurde bereits positiv bestaetigt. Dieses Agenda item ist damit jetzt aktiv eingeplant.';
}

function buildDetailsLink(step: StepRunLike, amendmentId: string) {
  if (step.event?.id && step.agenda_item?.id) {
    return `/event/${step.event.id}/agenda/${step.agenda_item.id}`;
  }

  if (step.event?.id) {
    return `/event/${step.event.id}/agenda`;
  }

  return `/amendment/${amendmentId}`;
}

function buildPreviewItem(args: {
  step: StepRunLike;
  amendmentId: string;
  amendmentTitle: string;
  fallbackTargetGroupName: string;
}) {
  if (isTerminalStatus(args.step.status) || isTerminalStatus(args.step.decision_status)) {
    return null;
  }

  const state: PreviewItem['state'] =
    args.step.decision_status === 'previous_decision_outstanding' ||
    args.step.agenda_item?.forwarding_status === 'previous_decision_outstanding'
      ? 'scheduled_but_not_confirmed'
      : 'scheduled';
  const isPredicted = !args.step.agenda_item?.id;
  const targetGroupName = buildStepTargetGroupName(args.step, args.fallbackTargetGroupName);
  const timelineTimes = getAgendaDisplayTimes({
    activated_at: args.step.agenda_item?.activated_at ?? null,
    completed_at: args.step.agenda_item?.completed_at ?? null,
    start_time: args.step.agenda_item?.start_time ?? null,
    end_time: args.step.agenda_item?.end_time ?? null,
    calculated_start_time: args.step.event?.start_date ?? args.step.starts_at ?? null,
    calculated_end_time: args.step.event?.end_date ?? null,
  });
  const rawStatus =
    args.step.agenda_item?.status ?? (state === 'scheduled' ? 'pending' : 'planned');

  return {
    id: args.step.agenda_item?.id ?? args.step.id,
    title:
      args.step.agenda_item?.title?.trim() ||
      buildFallbackAgendaTitle(args.step, args.amendmentTitle),
    description: buildPreviewDescription({
      step: args.step,
      isPredicted,
      state,
      targetGroupName,
    }),
    subtitle: args.step.event?.title?.trim() || `Event noch nicht verknuepft · ${targetGroupName}`,
    detailsLink: buildDetailsLink(args.step, args.amendmentId),
    type: getAgendaDisplayType({
      agendaItemType: args.step.agenda_item?.type ?? null,
      stepKind: args.step.step_kind ?? null,
      supportConfirmationId: args.step.support_confirmation_id ?? null,
    }),
    status: getAgendaRuntimeStatus({
      id: args.step.agenda_item?.id ?? args.step.id,
      status: rawStatus,
      start_time: args.step.agenda_item?.start_time ?? null,
      end_time: args.step.agenda_item?.end_time ?? null,
      activated_at: args.step.agenda_item?.activated_at ?? null,
      completed_at: args.step.agenda_item?.completed_at ?? null,
    }),
    state,
    order: args.step.order_index + 1,
    duration:
      typeof args.step.agenda_item?.duration === 'number' && args.step.agenda_item.duration > 0
        ? args.step.agenda_item.duration
        : 30,
    displayStartTime: timelineTimes.displayStartTime,
    displayEndTime: timelineTimes.displayEndTime,
  } satisfies PreviewItem;
}

function TimelineList({
  items,
  amendmentId,
  amendmentTitle,
}: {
  items: PreviewItem[];
  amendmentId: string;
  amendmentTitle: string;
}) {
  return (
    <div className="space-y-6">
      {items.map(item => (
        <TimelineItem
          key={item.id}
          order={item.order}
          startTime={formatTime(item.displayStartTime)}
          endTime={formatTime(item.displayEndTime)}
          duration={item.duration}
        >
          <AgendaCard
            id={item.id}
            title={item.title}
            subtitle={item.subtitle}
            description={item.description}
            type={item.type}
            status={item.status}
            detailsLink={item.detailsLink}
            amendment={{ id: amendmentId, title: amendmentTitle }}
          />
        </TimelineItem>
      ))}
    </div>
  );
}

export function ProcessAgendaPreviewDialog({
  open,
  onOpenChange,
  amendmentId,
  amendmentTitle,
  processRunId,
  focusStepRunId,
}: ProcessAgendaPreviewDialogProps) {
  const { amendmentProcess } = useAmendmentState({
    amendmentId,
    includeProcessData: open,
  });

  const activeRun = useMemo(() => {
    if (!amendmentProcess) {
      return null;
    }

    if (processRunId && amendmentProcess.current_process_run?.id === processRunId) {
      return amendmentProcess.current_process_run;
    }

    if (processRunId) {
      const matchingRun = (amendmentProcess.process_runs ?? []).find(
        run => run.id === processRunId
      );
      if (matchingRun) {
        return matchingRun;
      }
    }

    return amendmentProcess.current_process_run ?? amendmentProcess.process_runs?.[0] ?? null;
  }, [amendmentProcess, processRunId]);

  const activeBranch = useMemo(() => {
    if (!activeRun) {
      return null;
    }

    return (
      activeRun.branches?.find(branch => branch.id === activeRun.active_branch_id) ??
      activeRun.branches?.[0] ??
      null
    );
  }, [activeRun]);

  const resolvedAmendmentTitle =
    amendmentProcess?.title?.trim() || amendmentTitle?.trim() || 'Aenderungsantrag';
  const previewItems = useMemo(() => {
    const branchStepRuns = [...(activeBranch?.step_runs ?? [])].sort(
      (left, right) => left.order_index - right.order_index
    ) as StepRunLike[];
    const selectedStep =
      (focusStepRunId
        ? branchStepRuns.find(step => step.id === focusStepRunId)
        : branchStepRuns[0]) ?? null;

    if (!selectedStep) {
      return [];
    }

    const previewItem = buildPreviewItem({
      step: selectedStep,
      amendmentId,
      amendmentTitle: resolvedAmendmentTitle,
      fallbackTargetGroupName: activeRun?.selected_target_group?.name ?? 'die zustaendige Gruppe',
    });

    return previewItem ? [previewItem] : [];
  }, [
    activeBranch?.step_runs,
    activeRun?.selected_target_group?.name,
    amendmentId,
    focusStepRunId,
    resolvedAmendmentTitle,
  ]);

  const scheduledItems = useMemo(
    () => previewItems.filter(item => item.state === 'scheduled'),
    [previewItems]
  );
  const scheduledButNotConfirmedItems = useMemo(
    () => previewItems.filter(item => item.state === 'scheduled_but_not_confirmed'),
    [previewItems]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Neue Agenda items anzeigen</DialogTitle>
          <DialogDescription>
            Timeline-Vorschau der Agenda items aus diesem Antragsprozess.
          </DialogDescription>
        </DialogHeader>

        {previewItems.length === 0 ? (
          <div className="text-muted-foreground flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Fuer diesen Antragsprozess gibt es aktuell keine geplanten oder noch nicht
              bestaetigten Agenda items.
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            {scheduledItems.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Scheduled</h3>
                  <p className="text-muted-foreground text-sm">
                    Agenda items, deren vorheriger Prozessschritt bereits positiv bestaetigt wurde.
                  </p>
                </div>

                <TimelineList
                  items={scheduledItems}
                  amendmentId={amendmentId}
                  amendmentTitle={resolvedAmendmentTitle}
                />
              </div>
            ) : null}

            {scheduledButNotConfirmedItems.length > 0 ? (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle>Scheduled but not confirmed</CardTitle>
                  <CardDescription>
                    Agenda items, deren darunter liegende Abstimmung noch aussteht.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TimelineList
                    items={scheduledButNotConfirmedItems}
                    amendmentId={amendmentId}
                    amendmentTitle={resolvedAmendmentTitle}
                  />
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  TargetGroupEventDisplay,
  TargetGroupEventSelector,
  type TargetGroupEventSelection,
} from '@/features/amendments/ui/TargetGroupEventSelector';
import { enrichPathSegments } from '@/features/amendments/logic/amendmentPathHelpers';
import { useCreateAmendmentPath } from '@/features/amendments/hooks/useCreateAmendmentPath';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { cn } from '@/features/shared/utils/utils';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GitBranch,
  Target,
  Workflow,
} from 'lucide-react';
import { AmendmentProcessDetailsPanel } from '@/features/amendments/ui/AmendmentProcessDetailsPanel';
import {
  buildAmendmentPathGroupTypeById,
  buildAmendmentPathVisualizationData,
  findLikelyActiveAmendmentStep,
  getFirstUnresolvedAmendmentStepId,
  isLikelyActiveAmendmentStep,
} from '@/features/amendments/logic/buildAmendmentPathVisualizationData';
import { normalizeGroupAmendmentDisplayStatus } from '@/features/groups/logic/groupAmendmentStatus';

interface AmendmentProcessFlowProps {
  amendmentId: string;
}

function formatDateTime(timestamp?: number | null) {
  if (!timestamp) {
    return 'Not scheduled';
  }

  return new Date(timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getBadgeVariant(
  status?: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
    case 'accepted':
    case 'completed':
    case 'merged':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'pending_event':
    case 'scheduled':
    case 'in_vote':
    case 'supported':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getStatusBadgeClassName(status?: string | null) {
  switch (status) {
    case 'approved':
    case 'accepted':
    case 'completed':
    case 'merged':
      return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'rejected':
    case 'withdrawn':
      return 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300';
    case 'pending_event':
    case 'scheduled':
      return 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300';
    case 'in_vote':
    case 'supported':
      return 'border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'previous_decision_outstanding':
      return 'border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-300';
    case 'forward_confirmed':
      return 'border-indigo-500/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300';
    default:
      return 'border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300';
  }
}

function getInfoBadgeClassName(tone: 'group' | 'workflow' | 'count' | 'step' | 'current' | 'task') {
  switch (tone) {
    case 'group':
      return 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300';
    case 'workflow':
      return 'border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300';
    case 'count':
      return 'border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300';
    case 'step':
      return 'border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300';
    case 'current':
      return 'border-lime-500/30 bg-lime-500/15 text-lime-700 dark:text-lime-300';
    case 'task':
      return 'border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300';
  }
}

function GroupReference({
  group,
  label,
  badgeClassName,
  textClassName,
}: {
  group?: { id?: string | null; name?: string | null } | null;
  label?: string;
  badgeClassName?: string;
  textClassName?: string;
}) {
  if (!group?.name) {
    return null;
  }

  const content = (
    <>
      <Building2 className="h-3 w-3" />
      {label ? <span className="font-medium">{label}:</span> : null}
      <span>{group.name}</span>
      {group.id ? <ExternalLink className="h-3 w-3 opacity-60" /> : null}
    </>
  );

  return (
    <Badge variant="outline" className={cn('gap-1.5', badgeClassName)}>
      {group.id ? (
        <Link
          to="/group/$id"
          params={{ id: group.id }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm hover:underline',
            textClassName
          )}
        >
          {content}
        </Link>
      ) : (
        <span className={cn('inline-flex items-center gap-1.5', textClassName)}>{content}</span>
      )}
    </Badge>
  );
}

function EventReference({
  event,
  className,
}: {
  event?: { id?: string | null; title?: string | null } | null;
  className?: string;
}) {
  if (!event?.title) {
    return null;
  }

  if (!event.id) {
    return <span className={className}>{event.title}</span>;
  }

  return (
    <Link
      to="/event/$id/agenda"
      params={{ id: event.id }}
      className={cn('text-primary inline-flex items-center gap-1 hover:underline', className)}
    >
      <span>{event.title}</span>
      <ExternalLink className="h-3 w-3 opacity-60" />
    </Link>
  );
}

const TERMINAL_PATH_DISPLAY_STATUSES = new Set([
  'approved',
  'accepted',
  'supported',
  'merged',
  'completed',
  'rejected',
  'withdrawn',
]);

export function AmendmentProcessFlow({ amendmentId }: AmendmentProcessFlowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<TargetGroupEventSelection | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { createAmendmentPath } = useCreateAmendmentPath();
  const { updateAmendment } = useAmendmentActions();

  const {
    amendmentProcess: amendment,
    collaborators,
    isLoading,
  } = useAmendmentState({
    amendmentId,
    includeProcessData: true,
  });

  const currentRun = amendment?.current_process_run ?? null;
  const allRuns = useMemo(
    () =>
      [...(amendment?.process_runs ?? [])].sort(
        (left, right) => right.created_at - left.created_at
      ),
    [amendment?.process_runs]
  );
  const historicalRuns = useMemo(
    () => allRuns.filter(run => run.id !== currentRun?.id),
    [allRuns, currentRun?.id]
  );
  const branches = useMemo(
    () =>
      [...(currentRun?.branches ?? [])].sort((left, right) => left.created_at - right.created_at),
    [currentRun?.branches]
  );
  const currentRunStepRuns = useMemo(
    () =>
      [...(currentRun?.step_runs ?? [])].sort((left, right) => {
        if ((left.branch_id ?? '') !== (right.branch_id ?? '')) {
          return (left.branch_id ?? '').localeCompare(right.branch_id ?? '');
        }

        return left.order_index - right.order_index;
      }),
    [currentRun?.step_runs]
  );
  const displayPath = useMemo(() => {
    const paths = [...(amendment?.paths ?? [])];
    if (paths.length === 0) {
      return null;
    }

    const currentRunStepRunIds = new Set(currentRunStepRuns.map(step => step.id));

    return (
      paths
        .map(path => {
          const segments = path.segments ?? [];
          return {
            path,
            isCurrentRunPath: path.process_run_id === currentRun?.id,
            overlapCount: segments.filter(
              segment =>
                segment.process_step_run_id && currentRunStepRunIds.has(segment.process_step_run_id)
            ).length,
            terminalCount: segments.filter(segment =>
              TERMINAL_PATH_DISPLAY_STATUSES.has(segment.status ?? '')
            ).length,
            createdAt: path.created_at ?? 0,
          };
        })
        .sort((left, right) => {
          if (left.isCurrentRunPath !== right.isCurrentRunPath) {
            return left.isCurrentRunPath ? -1 : 1;
          }

          if (left.overlapCount !== right.overlapCount) {
            return right.overlapCount - left.overlapCount;
          }

          if (left.terminalCount !== right.terminalCount) {
            return right.terminalCount - left.terminalCount;
          }

          return right.createdAt - left.createdAt;
        })[0]?.path ?? null
    );
  }, [amendment?.paths, currentRun?.id, currentRunStepRuns]);
  const displayPathSegments = useMemo(
    () =>
      [...(displayPath?.segments ?? [])].sort(
        (left, right) => left.order_index - right.order_index
      ),
    [displayPath?.segments]
  );
  const displayPathSegmentByStepRunId = useMemo(
    () =>
      new Map(
        displayPathSegments
          .filter(segment => segment.process_step_run_id)
          .map(segment => [segment.process_step_run_id ?? '', segment])
      ),
    [displayPathSegments]
  );
  const displayPathSegmentByOrder = useMemo(
    () => new Map(displayPathSegments.map(segment => [segment.order_index, segment])),
    [displayPathSegments]
  );
  const currentRunDisplayStepRuns = useMemo(
    () =>
      currentRunStepRuns.map(step => {
        const matchingSegment =
          displayPathSegmentByStepRunId.get(step.id) ??
          displayPathSegmentByOrder.get(step.order_index);

        if (!matchingSegment?.status) {
          return step;
        }

        return {
          ...step,
          status: matchingSegment.status,
          decision_status: matchingSegment.status,
        };
      }),
    [currentRunStepRuns, displayPathSegmentByOrder, displayPathSegmentByStepRunId]
  );
  const derivedActiveStepRun = useMemo(
    () => findLikelyActiveAmendmentStep(currentRunDisplayStepRuns),
    [currentRunDisplayStepRuns]
  );
  const resolvedActiveBranchId =
    derivedActiveStepRun?.branch_id ??
    currentRun?.active_branch_id ??
    currentRun?.terminal_step_run?.branch_id ??
    displayPathSegments[0]?.process_branch_id ??
    branches[0]?.id ??
    null;
  const activeBranch = useMemo(
    () => branches.find(branch => branch.id === resolvedActiveBranchId) ?? branches[0] ?? null,
    [branches, resolvedActiveBranchId]
  );
  const activeBranchStepRuns = useMemo(() => {
    const directStepRuns = currentRunDisplayStepRuns.filter(
      step => step.branch_id === resolvedActiveBranchId
    );

    if (directStepRuns.length > 0) {
      return directStepRuns;
    }

    return [...(activeBranch?.step_runs ?? [])]
      .sort((left, right) => left.order_index - right.order_index)
      .map(step => {
        const matchingSegment =
          displayPathSegmentByStepRunId.get(step.id) ??
          displayPathSegmentByOrder.get(step.order_index);

        if (!matchingSegment?.status) {
          return step;
        }

        return {
          ...step,
          status: matchingSegment.status,
          decision_status: matchingSegment.status,
        };
      });
  }, [
    activeBranch?.step_runs,
    currentRunDisplayStepRuns,
    displayPathSegmentByOrder,
    displayPathSegmentByStepRunId,
    resolvedActiveBranchId,
  ]);
  const firstUnresolvedStepId = useMemo(
    () =>
      (derivedActiveStepRun?.branch_id === resolvedActiveBranchId
        ? derivedActiveStepRun.id
        : null) ?? getFirstUnresolvedAmendmentStepId(activeBranchStepRuns),
    [
      activeBranchStepRuns,
      derivedActiveStepRun?.branch_id,
      derivedActiveStepRun?.id,
      resolvedActiveBranchId,
    ]
  );
  const openTasks = useMemo(
    () =>
      (currentRun?.tasks ?? []).filter(
        task => task.status === 'open' || task.status === 'scheduled'
      ),
    [currentRun?.tasks]
  );
  const groupDecisions = useMemo(
    () =>
      [...(amendment?.group_decisions ?? [])].sort(
        (left, right) =>
          (right.decided_at ?? right.updated_at ?? 0) - (left.decided_at ?? left.updated_at ?? 0)
      ),
    [amendment?.group_decisions]
  );
  const groupTypeById = useMemo(
    () => buildAmendmentPathGroupTypeById(activeBranchStepRuns),
    [activeBranchStepRuns]
  );
  const pathVisualizationData = useMemo(
    () =>
      buildAmendmentPathVisualizationData(activeBranchStepRuns, {
        activeStepId: firstUnresolvedStepId,
        isEventRequestPending: step =>
          openTasks.some(
            task =>
              task.step_run_id === step.id &&
              task.task_type === 'schedule_event' &&
              task.status === 'open'
          ) && !step.event_id,
      }),
    [activeBranchStepRuns, firstUnresolvedStepId, openTasks]
  );

  useEffect(() => {
    console.log('PROCESS LOG [amendment-process-flow][path-debug]', {
      amendmentId,
      processRunId: currentRun?.id ?? null,
      displayPathId: displayPath?.id ?? null,
      displayPathProcessRunId: displayPath?.process_run_id ?? null,
      storedActiveBranchId: currentRun?.active_branch_id ?? null,
      resolvedActiveBranchId,
      activeBranchId: activeBranch?.id ?? null,
      firstUnresolvedStepId,
      derivedActiveStepRun: derivedActiveStepRun
        ? {
            id: derivedActiveStepRun.id,
            branchId: derivedActiveStepRun.branch_id ?? null,
            order: derivedActiveStepRun.order_index,
            status: derivedActiveStepRun.status ?? null,
            decisionStatus: derivedActiveStepRun.decision_status ?? null,
          }
        : null,
      currentRunStepRuns: currentRunStepRuns.map(step => ({
        id: step.id,
        branchId: step.branch_id ?? null,
        order: step.order_index,
        groupName: step.target_group?.name ?? step.workflow_step?.label ?? null,
        status: step.status ?? null,
        decisionStatus: step.decision_status ?? null,
        eventId: step.event_id ?? null,
        isLikelyActive: isLikelyActiveAmendmentStep(step),
      })),
      currentRunDisplayStepRuns: currentRunDisplayStepRuns.map(step => ({
        id: step.id,
        branchId: step.branch_id ?? null,
        order: step.order_index,
        groupName: step.target_group?.name ?? step.workflow_step?.label ?? null,
        status: step.status ?? null,
        decisionStatus: step.decision_status ?? null,
        eventId: step.event_id ?? null,
        isLikelyActive: isLikelyActiveAmendmentStep(step),
      })),
      displayPathSegments: displayPathSegments.map(segment => ({
        id: segment.id,
        processStepRunId: segment.process_step_run_id ?? null,
        processBranchId: segment.process_branch_id ?? null,
        order: segment.order_index,
        status: segment.status ?? null,
        groupName: segment.group?.name ?? null,
        eventTitle: segment.event?.title ?? null,
      })),
      stepRuns: activeBranchStepRuns.map(step => ({
        id: step.id,
        branchId: step.branch_id ?? null,
        order: step.order_index,
        groupName: step.target_group?.name ?? step.workflow_step?.label ?? null,
        status: step.status ?? null,
        decisionStatus: step.decision_status ?? null,
        eventId: step.event_id ?? null,
        isLikelyActive: isLikelyActiveAmendmentStep(step),
      })),
      visualization: pathVisualizationData.map(segment => ({
        order: segment.order,
        groupName: segment.groupName,
        forwardingStatus: segment.forwardingStatus,
        rawStatus: segment.rawStatus ?? null,
        rawDecisionStatus: segment.rawDecisionStatus ?? null,
        isActiveStep: segment.isActiveStep ?? false,
      })),
    });
  }, [
    activeBranch?.id,
    activeBranchStepRuns,
    amendmentId,
    currentRun?.id,
    currentRun?.active_branch_id,
    currentRun?.terminal_step_run?.branch_id,
    currentRunDisplayStepRuns,
    currentRunStepRuns,
    displayPath?.id,
    displayPath?.process_run_id,
    displayPathSegments,
    derivedActiveStepRun,
    firstUnresolvedStepId,
    pathVisualizationData,
    resolvedActiveBranchId,
  ]);

  const selectorCollaborators = useMemo(
    () =>
      (collaborators ?? [])
        .map(collaborator => collaborator.user)
        .filter((currentUser): currentUser is NonNullable<typeof currentUser> =>
          Boolean(currentUser?.id)
        )
        .map(currentUser => ({
          id: currentUser.id,
          name: `${currentUser.first_name ?? ''} ${currentUser.last_name ?? ''}`.trim() || 'User',
          email: currentUser.email ?? undefined,
          avatar: currentUser.avatar ?? undefined,
        })),
    [collaborators]
  );

  const handleConfirmSelection = async () => {
    if (!pendingSelection || !amendment || !user) {
      return;
    }

    setIsSaving(true);
    try {
      const enrichedPath = enrichPathSegments(
        pendingSelection.pathWithEvents,
        pendingSelection.groupId,
        pendingSelection.eventId,
        pendingSelection.eventData?.title ?? null,
        pendingSelection.eventData?.start_date ?? null,
        pendingSelection.eventData?.end_date ?? null
      );

      await createAmendmentPath({
        amendmentId,
        amendmentTitle: amendment.title ?? '',
        amendmentReason: amendment.reason ?? null,
        enrichedPath,
        sourceGroupId: pendingSelection.sourceGroupId,
        workflowId: pendingSelection.workflowId,
        pathMode: pendingSelection.pathMode,
      });

      await updateAmendment({
        id: amendmentId,
        group_id: pendingSelection.groupId,
        event_id: pendingSelection.eventId ?? null,
      });

      toast.success(
        currentRun
          ? t('features.amendments.process.retargetSuccess')
          : t('features.amendments.process.targetSetSuccess')
      );

      setSelectorOpen(false);
      setPendingSelection(null);
    } catch (error) {
      console.error('Error starting amendment process:', error);
      toast.error(t('features.amendments.process.startFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-[480px] items-center justify-center">
        <p className="text-muted-foreground">{t('features.amendments.process.pleaseLogin')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[480px] items-center justify-center">
        <p className="text-muted-foreground">{t('features.amendments.process.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t('features.amendments.process.title')}
              </CardTitle>
              <CardDescription>
                {currentRun
                  ? t('features.amendments.process.activeRunDescription')
                  : t('features.amendments.process.noRunDescription')}
              </CardDescription>
            </div>

            <Button
              onClick={() => {
                setPendingSelection(null);
                setSelectorOpen(true);
              }}
            >
              {currentRun
                ? t('features.amendments.process.retarget')
                : t('features.amendments.process.start')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentRun ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={getBadgeVariant(currentRun.status)}
                  className={getStatusBadgeClassName(currentRun.status)}
                >
                  {currentRun.status}
                </Badge>
                <GroupReference
                  group={currentRun.selected_source_group}
                  label={t('features.amendments.process.sourceGroup')}
                  badgeClassName={getInfoBadgeClassName('group')}
                />
                <GroupReference
                  group={currentRun.selected_target_group}
                  label={t('features.amendments.process.targetGroup')}
                  badgeClassName={getInfoBadgeClassName('group')}
                />
                {currentRun.selected_target_workflow?.name ? (
                  <Badge
                    variant="secondary"
                    className={cn('gap-1.5', getInfoBadgeClassName('workflow'))}
                  >
                    <Workflow className="mr-1 h-3 w-3" />
                    {currentRun.selected_target_workflow.name}
                  </Badge>
                ) : null}
                <Badge
                  variant="secondary"
                  className={cn('gap-1.5', getInfoBadgeClassName('count'))}
                >
                  <GitBranch className="mr-1 h-3 w-3" />
                  {branches.length} {t('features.amendments.process.branchCount')}
                </Badge>
                <Badge
                  variant={openTasks.length > 0 ? 'secondary' : 'outline'}
                  className={cn(
                    'gap-1.5',
                    openTasks.length > 0
                      ? getInfoBadgeClassName('task')
                      : getInfoBadgeClassName('step')
                  )}
                >
                  <Clock3 className="mr-1 h-3 w-3" />
                  {openTasks.length} {t('features.amendments.process.openTasks')}
                </Badge>
              </div>

              {currentRun.implementation_status ? (
                <div className="rounded-lg border px-4 py-3 text-sm">
                  <p className="font-medium">
                    {t('features.amendments.process.implementationStatus')}
                  </p>
                  <p className="text-muted-foreground mt-1">{currentRun.implementation_status}</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="border-border bg-muted/30 rounded-lg border border-dashed p-4 text-sm">
              {t('features.amendments.process.noCurrentRun')}
            </div>
          )}
        </CardContent>
      </Card>

      {currentRun && activeBranch ? (
        <>
          <AmendmentProcessDetailsPanel
            amendment={{
              id: amendment.id,
              title: amendment.title,
              reason: amendment.reason,
              preamble: amendment.preamble,
              editing_mode: amendment.editing_mode,
              group: amendment.group ?? null,
            }}
            pathVisualizationData={pathVisualizationData}
            groupTypeById={groupTypeById}
            onGroupClick={groupId => navigate({ to: '/group/$id', params: { id: groupId } })}
            onEventClick={eventId => navigate({ to: '/event/$id/agenda', params: { id: eventId } })}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('features.amendments.process.activeBranch')}
              </CardTitle>
              <CardDescription>
                {activeBranch.title ?? t('features.amendments.process.activeBranchDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                {activeBranchStepRuns.map(step => {
                  const isCurrentStep = step.id === firstUnresolvedStepId;
                  const relatedTasks = openTasks.filter(task => task.step_run_id === step.id);
                  const hasPendingScheduleEventTask = relatedTasks.some(
                    task => task.task_type === 'schedule_event' && task.status === 'open'
                  );

                  return (
                    <div key={step.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn('gap-1.5', getInfoBadgeClassName('step'))}
                            >
                              {t('features.amendments.process.step')} {step.order_index + 1}
                            </Badge>
                            <Badge
                              variant={getBadgeVariant(step.status)}
                              className={getStatusBadgeClassName(step.status)}
                            >
                              {step.status}
                            </Badge>
                            {step.decision_status ? (
                              <Badge
                                variant={getBadgeVariant(step.decision_status)}
                                className={getStatusBadgeClassName(step.decision_status)}
                              >
                                {step.decision_status}
                              </Badge>
                            ) : null}
                            {isCurrentStep ? (
                              <Badge
                                variant="secondary"
                                className={cn('gap-1.5', getInfoBadgeClassName('current'))}
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                {t('features.amendments.process.currentStep')}
                              </Badge>
                            ) : null}
                            {!step.event?.title && hasPendingScheduleEventTask ? (
                              <Badge
                                variant="secondary"
                                className={cn('gap-1.5', getInfoBadgeClassName('task'))}
                              >
                                <Clock3 className="mr-1 h-3 w-3" />
                                {t('features.amendments.process.eventRequestedPending')}
                              </Badge>
                            ) : null}
                          </div>

                          <div>
                            {step.target_group?.name ? (
                              step.target_group.id ? (
                                <Link
                                  to="/group/$id"
                                  params={{ id: step.target_group.id }}
                                  className="inline-flex items-center gap-1 font-medium hover:underline"
                                >
                                  <span>{step.target_group.name}</span>
                                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                                </Link>
                              ) : (
                                <p className="font-medium">{step.target_group.name}</p>
                              )
                            ) : (
                              <p className="font-medium">
                                {step.workflow_step?.label ??
                                  t('features.amendments.process.unknownGroup')}
                              </p>
                            )}
                            <p className="text-muted-foreground text-sm">
                              {step.step_kind}
                              {step.workflow?.name ? ` - ${step.workflow.name}` : ''}
                            </p>
                          </div>

                          <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              {formatDateTime(step.starts_at)}
                            </span>
                            {step.event?.title ? (
                              <EventReference event={step.event} />
                            ) : (
                              <span>
                                {hasPendingScheduleEventTask
                                  ? t('features.amendments.process.eventRequestedPending')
                                  : t('features.amendments.process.pendingEvent')}
                              </span>
                            )}
                          </div>
                        </div>

                        {relatedTasks.length > 0 ? (
                          <div className="min-w-[16rem] space-y-2 rounded-lg border border-dashed p-3">
                            <p className="text-sm font-medium">
                              {t('features.amendments.process.relatedTasks')}
                            </p>
                            {relatedTasks.map(task => (
                              <div key={task.id} className="space-y-1 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant={getBadgeVariant(task.status)}
                                    className={getStatusBadgeClassName(task.status)}
                                  >
                                    {task.status}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={getInfoBadgeClassName('task')}
                                  >
                                    {task.task_type}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground">
                                  {task.title ?? task.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('features.amendments.process.branches')}
              </CardTitle>
              <CardDescription>
                {t('features.amendments.process.branchesDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {branches.map(branch => {
                const branchStepRuns = [...(branch.step_runs ?? [])].sort(
                  (left, right) => left.order_index - right.order_index
                );
                const branchTasks = [...(branch.tasks ?? [])].filter(
                  task => task.status === 'open' || task.status === 'scheduled'
                );

                return (
                  <div key={branch.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              branch.id === currentRun.active_branch_id ? 'default' : 'outline'
                            }
                            className={
                              branch.id === currentRun.active_branch_id
                                ? getInfoBadgeClassName('current')
                                : getInfoBadgeClassName('step')
                            }
                          >
                            {branch.id === currentRun.active_branch_id
                              ? t('features.amendments.process.activeBranchBadge')
                              : t('features.amendments.process.branchBadge')}
                          </Badge>
                          <Badge
                            variant={getBadgeVariant(branch.status)}
                            className={getStatusBadgeClassName(branch.status)}
                          >
                            {branch.status}
                          </Badge>
                          {branch.resolution ? (
                            <Badge
                              variant={getBadgeVariant(branch.resolution)}
                              className={getStatusBadgeClassName(branch.resolution)}
                            >
                              {branch.resolution}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="font-medium">
                          {branch.title ?? t('features.amendments.process.untitledBranch')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {branchStepRuns.map((step, index) => (
                            <div key={step.id} className="flex items-center gap-2">
                              <Badge
                                variant={getBadgeVariant(step.status)}
                                className={cn('gap-1.5', getStatusBadgeClassName(step.status))}
                              >
                                {step.target_group?.id && step.target_group?.name ? (
                                  <Link
                                    to="/group/$id"
                                    params={{ id: step.target_group.id }}
                                    className="inline-flex items-center gap-1 hover:underline"
                                  >
                                    <span>{step.target_group.name}</span>
                                    <ExternalLink className="h-3 w-3 opacity-60" />
                                  </Link>
                                ) : (
                                  <span>
                                    {step.target_group?.name ??
                                      step.workflow_step?.label ??
                                      `Step ${step.order_index + 1}`}
                                  </span>
                                )}
                              </Badge>
                              {index < branchStepRuns.length - 1 ? (
                                <ArrowRight className="text-muted-foreground h-3 w-3" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      {branchTasks.length > 0 ? (
                        <div className="min-w-[12rem] rounded-lg border border-dashed p-3 text-xs">
                          <p className="font-medium">
                            {t('features.amendments.process.openTasks')}
                          </p>
                          <p className="text-muted-foreground mt-1">
                            {branchTasks.length}{' '}
                            {t('features.amendments.process.tasksNeedAttention')}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('features.amendments.process.groupDecisions')}
          </CardTitle>
          <CardDescription>
            {t('features.amendments.process.groupDecisionsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupDecisions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('features.amendments.process.noGroupDecisions')}
            </p>
          ) : (
            <div className="space-y-3">
              {groupDecisions.map(decision => (
                <div key={decision.id} className="rounded-lg border p-4">
                  {(() => {
                    const visibleStatus =
                      normalizeGroupAmendmentDisplayStatus(decision.status) ?? decision.status;

                    return (
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          {decision.group?.id && decision.group?.name ? (
                            <Link
                              to="/group/$id"
                              params={{ id: decision.group.id }}
                              className="inline-flex items-center gap-1 font-medium hover:underline"
                            >
                              <span>{decision.group.name}</span>
                              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                            </Link>
                          ) : (
                            <p className="font-medium">
                              {decision.group?.name ??
                                t('features.amendments.process.unknownGroup')}
                            </p>
                          )}
                          <p className="text-muted-foreground text-xs">
                            {formatDateTime(decision.decided_at ?? decision.updated_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant={getBadgeVariant(visibleStatus)}
                            className={getStatusBadgeClassName(visibleStatus)}
                          >
                            {visibleStatus}
                          </Badge>
                          {decision.process_run_id ? (
                            <Badge variant="outline" className={getInfoBadgeClassName('step')}>
                              {translateText('generated.inline.0018_run_df6ad190')}
                              {decision.process_run_id.slice(0, 8)}
                            </Badge>
                          ) : null}
                          {decision.process_branch_id ? (
                            <Badge variant="outline" className={getInfoBadgeClassName('step')}>
                              {translateText('generated.inline.0019_branch_10d735e5')}
                              {decision.process_branch_id.slice(0, 8)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {historicalRuns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('features.amendments.process.runHistory')}
            </CardTitle>
            <CardDescription>
              {t('features.amendments.process.runHistoryDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {historicalRuns.map(run => (
              <div key={run.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={getBadgeVariant(run.status)}
                        className={getStatusBadgeClassName(run.status)}
                      >
                        {run.status}
                      </Badge>
                      {run.selected_target_workflow?.name ? (
                        <Badge variant="secondary" className={getInfoBadgeClassName('workflow')}>
                          {run.selected_target_workflow.name}
                        </Badge>
                      ) : null}
                    </div>
                    {run.selected_target_group?.id && run.selected_target_group?.name ? (
                      <Link
                        to="/group/$id"
                        params={{ id: run.selected_target_group.id }}
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        <span>{run.selected_target_group.name}</span>
                        <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                      </Link>
                    ) : (
                      <p className="font-medium">
                        {run.selected_target_group?.name ??
                          t('features.amendments.process.unknownTarget')}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(run.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={getInfoBadgeClassName('count')}>
                      {run.branches?.length ?? 0} {t('features.amendments.process.branchCount')}
                    </Badge>
                    <Badge
                      variant={
                        run.tasks?.some(task => task.status !== 'completed')
                          ? 'secondary'
                          : 'outline'
                      }
                      className={
                        run.tasks?.some(task => task.status !== 'completed')
                          ? getInfoBadgeClassName('task')
                          : getInfoBadgeClassName('step')
                      }
                    >
                      {run.tasks?.filter(task => task.status !== 'completed').length ?? 0}{' '}
                      {t('features.amendments.process.openTasks')}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={selectorOpen}
        onOpenChange={open => {
          setSelectorOpen(open);
          if (!open) {
            setPendingSelection(null);
          }
        }}
      >
        <DialogContent className="flex h-screen w-screen max-w-none flex-col rounded-none border-0 p-0 sm:h-screen sm:max-w-none">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">
              {currentRun
                ? t('features.amendments.process.retargetDialogTitle')
                : t('features.amendments.process.startDialogTitle')}
            </DialogTitle>
            <DialogDescription className="px-6">
              {t('features.amendments.process.selectorDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              <TargetGroupEventSelector
                userId={user.id}
                collaborators={selectorCollaborators}
                disablePortal
                allowGroupWithoutEvent
                allowSourceGroupAsTarget
                layoutScope={currentRun ? 'amendment-process-retarget' : 'amendment-process-start'}
                onSelect={setPendingSelection}
              />

              {pendingSelection ? (
                <TargetGroupEventDisplay
                  groupData={{
                    id: pendingSelection.groupData.id,
                    name: pendingSelection.groupData.name ?? null,
                    description: richTextToPlainText(pendingSelection.groupData.description),
                    member_count: pendingSelection.groupData.member_count ?? null,
                    event_count: pendingSelection.groupData.event_count ?? null,
                    amendment_count: pendingSelection.groupData.amendment_count ?? null,
                  }}
                  eventData={
                    pendingSelection.eventData
                      ? {
                          id: pendingSelection.eventData.id,
                          title: pendingSelection.eventData.title ?? null,
                          start_date: pendingSelection.eventData.start_date ?? null,
                          location_name: pendingSelection.eventData.location_name ?? null,
                          description: richTextToPlainText(pendingSelection.eventData.description),
                          participant_count: pendingSelection.eventData.participant_count ?? null,
                        }
                      : null
                  }
                  pathWithEvents={pendingSelection.pathWithEvents}
                />
              ) : (
                <div className="border-border bg-muted/30 rounded-lg border border-dashed p-4 text-sm">
                  {t('features.amendments.process.selectorHint')}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={() => {
                setSelectorOpen(false);
                setPendingSelection(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmSelection} disabled={!pendingSelection || isSaving}>
              {isSaving
                ? t('features.amendments.process.processing')
                : currentRun
                  ? t('features.amendments.process.confirmRetarget')
                  : t('features.amendments.process.confirmStart')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

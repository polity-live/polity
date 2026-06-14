'use client';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAuth } from '@/providers/auth-provider';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { type TargetGroupEventSelection } from '@/features/amendments/ui/TargetGroupEventSelector';
import { enrichPathSegments } from '@/features/amendments/logic/amendmentPathHelpers';
import { useCreateAmendmentPath } from '@/features/amendments/hooks/useCreateAmendmentPath';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import {
  buildAmendmentPathGroupTypeById,
  buildAmendmentPathVisualizationData,
  findLikelyActiveAmendmentStep,
  getFirstUnresolvedAmendmentStepId,
  isLikelyActiveAmendmentStep,
} from '@/features/amendments/logic/buildAmendmentPathVisualizationData';
interface AmendmentProcessFlowProps {
  amendmentId: string;
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

export function useAmendmentProcessFlowController({ amendmentId }: AmendmentProcessFlowProps) {
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
        (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
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

  return {
    amendmentId,
    t,
    navigate,
    user,
    selectorOpen,
    setSelectorOpen,
    pendingSelection,
    setPendingSelection,
    isSaving,
    setIsSaving,
    createAmendmentPath,
    updateAmendment,
    amendment,
    collaborators,
    isLoading,
    currentRun,
    allRuns,
    historicalRuns,
    branches,
    currentRunStepRuns,
    displayPath,
    displayPathSegments,
    displayPathSegmentByStepRunId,
    displayPathSegmentByOrder,
    currentRunDisplayStepRuns,
    derivedActiveStepRun,
    resolvedActiveBranchId,
    activeBranch,
    activeBranchStepRuns,
    firstUnresolvedStepId,
    openTasks,
    groupDecisions,
    groupTypeById,
    pathVisualizationData,
    selectorCollaborators,
    handleConfirmSelection,
  };
}

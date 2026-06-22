'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useActionSubmission } from '@/features/shared/ui/action-submission';
import { useAuth } from '@/providers/auth-provider';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { type TargetGroupEventSelection } from '@/features/amendments/ui/TargetGroupEventSelector';
import {
  enrichPathSegments,
  getEligibleEventsForPathSegment,
  rehydratePathSegmentsWithWindows,
} from '@/features/amendments/logic/amendmentPathHelpers';
import { useCreateAmendmentPath } from '@/features/amendments/hooks/useCreateAmendmentPath';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import {
  buildAmendmentPathGroupTypeById,
  buildAmendmentPathVisualizationData,
  findLikelyActiveAmendmentStep,
  getFirstUnresolvedAmendmentStepId,
} from '@/features/amendments/logic/buildAmendmentPathVisualizationData';
import {
  buildBranchDiffCandidates,
  getLatestBranchWithContent,
  getWinnerBranch,
  resolveSelectedBranchId,
} from '@/features/amendments/logic/amendmentBranchDisplay';
interface AmendmentProcessFlowProps {
  amendmentId: string;
  requestedBranchId?: string | null;
  onBranchChange?: (branchId: string | null, options?: { replace?: boolean }) => void;
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
const TERMINAL_PROCESS_STEP_STATUSES = new Set([
  'approved',
  'rejected',
  'merged',
  'withdrawn',
  'completed',
]);
const TERMINAL_PROCESS_BRANCH_STATUSES = new Set(['completed', 'rejected', 'withdrawn', 'merged']);

function isTerminalProcessStep(status?: string | null) {
  return TERMINAL_PROCESS_STEP_STATUSES.has(status ?? '');
}

function isTerminalProcessBranch(status?: string | null) {
  return TERMINAL_PROCESS_BRANCH_STATUSES.has(status ?? '');
}

function getBranchStartGroupId(branch: any) {
  const firstStep = [...(branch?.step_runs ?? [])].sort(
    (left: any, right: any) => left.order_index - right.order_index
  )[0];

  return firstStep?.target_group_id ?? firstStep?.source_group_id ?? null;
}

export function useAmendmentProcessFlowController({
  amendmentId,
  requestedBranchId,
  onBranchChange,
}: AmendmentProcessFlowProps) {
  const { t } = useTranslation();

  const navigate = useNavigate();

  const { user } = useAuth();

  const [selectorOpen, setSelectorOpen] = useState(false);

  const [pendingSelection, setPendingSelection] = useState<TargetGroupEventSelection | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [eventEditorBranchId, setEventEditorBranchId] = useState<string | null>(null);
  const [eventDraftsByStepRunId, setEventDraftsByStepRunId] = useState<
    Record<string, string | null>
  >({});
  const [isReplanningBranchEvents, setIsReplanningBranchEvents] = useState(false);

  const processSubmission = useActionSubmission('process');

  const { createAmendmentPath } = useCreateAmendmentPath();

  const { updateAmendment, replanProcessBranchEvents } = useAmendmentActions();

  const {
    amendmentProcess: amendment,
    collaborators,
    documents,
    allEvents,
    isLoading,
  } = useAmendmentState({
    amendmentId,
    includeProcessData: true,
    includeNetworkData: true,
    includeDocuments: true,
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

  const activeBranchId = currentRun?.active_branch_id ?? null;

  const selectedBranchId = useMemo(
    () =>
      resolveSelectedBranchId({
        branches,
        requestedBranchId,
        activeBranchId,
      }),
    [activeBranchId, branches, requestedBranchId]
  );

  useEffect(() => {
    if (!onBranchChange) return;
    if (branches.length === 0) return;
    if ((requestedBranchId ?? null) === selectedBranchId) return;

    onBranchChange(selectedBranchId, { replace: true });
  }, [branches.length, onBranchChange, requestedBranchId, selectedBranchId]);

  const selectedBranch = useMemo(
    () => branches.find(branch => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );

  const branchDiffCandidates = useMemo(() => {
    const originalDocument =
      documents?.find(document => document.id === amendment?.document_id) ?? documents?.[0] ?? null;

    return buildBranchDiffCandidates({
      branches,
      originalContent: originalDocument?.content ?? null,
      activeBranchId,
    });
  }, [activeBranchId, amendment?.document_id, branches, documents]);

  const defaultBranchDiffRightCandidateId =
    (getWinnerBranch(branches, activeBranchId) ?? getLatestBranchWithContent(branches))?.id ?? null;

  const existingBranchStartGroupIds = useMemo(
    () =>
      branches
        .map(branch => getBranchStartGroupId(branch))
        .filter((groupId): groupId is string => Boolean(groupId)),
    [branches]
  );

  const currentRunPathMode: 'hierarchy' | 'workflow' = currentRun?.selected_target_workflow_id
    ? 'workflow'
    : 'hierarchy';

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

  const displayPathSegmentByBranchAndOrder = useMemo(
    () =>
      new Map(
        displayPathSegments.map(segment => [
          `${segment.process_branch_id ?? ''}:${segment.order_index ?? ''}`,
          segment,
        ])
      ),
    [displayPathSegments]
  );

  const currentRunDisplayStepRuns = useMemo(
    () =>
      currentRunStepRuns.map(step => {
        const matchingSegment =
          displayPathSegmentByStepRunId.get(step.id) ??
          displayPathSegmentByBranchAndOrder.get(`${step.branch_id ?? ''}:${step.order_index}`) ??
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
    [
      currentRunStepRuns,
      displayPathSegmentByBranchAndOrder,
      displayPathSegmentByOrder,
      displayPathSegmentByStepRunId,
    ]
  );

  const derivedActiveStepRun = useMemo(
    () => findLikelyActiveAmendmentStep(currentRunDisplayStepRuns),
    [currentRunDisplayStepRuns]
  );

  const resolvedActiveBranchId = selectedBranchId;

  const activeBranch = useMemo(() => selectedBranch, [selectedBranch]);

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
          displayPathSegmentByBranchAndOrder.get(`${step.branch_id ?? ''}:${step.order_index}`) ??
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
    displayPathSegmentByBranchAndOrder,
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

  const allEventsById = useMemo(
    () => new Map((allEvents ?? []).map(event => [event.id, event] as const)),
    [allEvents]
  );

  const eventEditorBranch = useMemo(
    () => branches.find(branch => branch.id === eventEditorBranchId) ?? null,
    [branches, eventEditorBranchId]
  );

  const branchEventEditorRows = useMemo(() => {
    if (!eventEditorBranch) {
      return [];
    }

    const stepRuns = [...(eventEditorBranch.step_runs ?? [])].sort(
      (left: any, right: any) => left.order_index - right.order_index
    );
    const lastDecidedOrderIndex = stepRuns.reduce(
      (latest: number, step: any) =>
        isTerminalProcessStep(step.status) ? Math.max(latest, step.order_index) : latest,
      -1
    );
    const pathSegments = rehydratePathSegmentsWithWindows(
      stepRuns.map((step: any) => {
        const draftEventId = Object.prototype.hasOwnProperty.call(eventDraftsByStepRunId, step.id)
          ? eventDraftsByStepRunId[step.id]
          : (step.event_id ?? null);
        const draftEvent =
          (draftEventId ? allEventsById.get(draftEventId) : null) ?? step.event ?? null;

        return {
          segmentKey: `branch:${eventEditorBranch.id}:${step.id}`,
          groupId: step.target_group_id ?? step.source_group_id ?? '',
          groupName:
            step.target_group?.name ?? step.source_group?.name ?? step.workflow_step?.label ?? '',
          eventId: draftEventId,
          eventTitle: draftEvent?.title ?? 'Pending event',
          eventStartDate:
            draftEvent?.start_date ?? (draftEventId === step.event_id ? step.starts_at : null),
          eventEndDate:
            draftEvent?.end_date ??
            draftEvent?.start_date ??
            (draftEventId === step.event_id ? step.starts_at : null),
          stepLabel: step.workflow_step?.label ?? null,
          stepKind: step.step_kind ?? 'group_vote',
          selectionMode: step.selection_mode ?? null,
          mergeStrategy: step.merge_strategy ?? null,
          eventRule: null,
          autoTaskOnMissingEvent: true,
          targetWorkflowId: step.workflow_step?.target_workflow_id ?? null,
          requiredAfter: null,
          requiredBefore: null,
        };
      })
    );

    return stepRuns.map((step: any, index: number) => {
      const segment = pathSegments[index];
      const editable =
        !isTerminalProcessBranch(eventEditorBranch.status) &&
        step.order_index > lastDecidedOrderIndex &&
        !isTerminalProcessStep(step.status);
      const selectedEventId = segment?.eventId ?? null;

      return {
        step,
        segment,
        editable,
        isDecided: step.order_index <= lastDecidedOrderIndex || isTerminalProcessStep(step.status),
        selectedEventId,
        eligibleEvents: segment
          ? getEligibleEventsForPathSegment({
              segment,
              events: allEvents ?? [],
            })
          : [],
      };
    });
  }, [allEvents, allEventsById, eventDraftsByStepRunId, eventEditorBranch]);

  const openBranchEventEditor = useCallback((branch: any) => {
    const drafts: Record<string, string | null> = {};
    for (const step of branch?.step_runs ?? []) {
      drafts[step.id] = step.event_id ?? null;
    }
    setEventDraftsByStepRunId(drafts);
    setEventEditorBranchId(branch?.id ?? null);
  }, []);

  const closeBranchEventEditor = useCallback(() => {
    setEventEditorBranchId(null);
    setEventDraftsByStepRunId({});
  }, []);

  const updateBranchEventDraft = useCallback((stepRunId: string, eventId: string | null) => {
    setEventDraftsByStepRunId(previous => ({
      ...previous,
      [stepRunId]: eventId,
    }));
  }, []);

  const saveBranchEventReplan = useCallback(() => {
    if (!eventEditorBranch) {
      return;
    }

    const eventUpdates = branchEventEditorRows
      .filter(row => row.editable)
      .map(row => ({
        step_run_id: row.step.id,
        event_id: Object.prototype.hasOwnProperty.call(eventDraftsByStepRunId, row.step.id)
          ? eventDraftsByStepRunId[row.step.id]
          : (row.step.event_id ?? null),
        original_event_id: row.step.event_id ?? null,
      }))
      .filter(update => update.event_id !== update.original_event_id)
      .map(({ step_run_id, event_id }) => ({ step_run_id, event_id }));

    if (eventUpdates.length === 0) {
      closeBranchEventEditor();
      return;
    }

    void processSubmission
      .runActionWithSubmission(
        async () => {
          setIsReplanningBranchEvents(true);
          await replanProcessBranchEvents({
            branch_id: eventEditorBranch.id,
            event_updates: eventUpdates,
          });
          toast.success(t('features.amendments.process.replanSuccess', 'Events aktualisiert.'));
        },
        {
          onSuccess: () => {
            processSubmission.reset();
            closeBranchEventEditor();
          },
        }
      )
      .catch(error => {
        console.error('Error replanning branch events:', error);
        toast.error(
          t('features.amendments.process.replanFailed', 'Events konnten nicht aktualisiert werden.')
        );
      })
      .finally(() => {
        setIsReplanningBranchEvents(false);
      });
  }, [
    branchEventEditorRows,
    closeBranchEventEditor,
    eventDraftsByStepRunId,
    eventEditorBranch,
    processSubmission,
    replanProcessBranchEvents,
    t,
  ]);

  const handleConfirmSelection = () => {
    if (!pendingSelection || !amendment || !user) {
      return;
    }

    void processSubmission
      .runActionWithSubmission(
        async () => {
          setIsSaving(true);

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

          if (!currentRun) {
            await updateAmendment({
              id: amendmentId,
              group_id: pendingSelection.groupId,
              event_id: pendingSelection.eventId ?? null,
            });
          }

          toast.success(
            currentRun
              ? t('features.amendments.process.additionalPathSuccess', 'Additional path added.')
              : t('features.amendments.process.targetSetSuccess')
          );
        },
        {
          onSuccess: () => {
            processSubmission.reset();
            setSelectorOpen(false);
            setPendingSelection(null);
          },
        }
      )
      .catch(error => {
        console.error('Error starting amendment process:', error);
        toast.error(t('features.amendments.process.startFailed'));
      })
      .finally(() => {
        setIsSaving(false);
      });
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
    processSubmission,
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
    displayPathSegmentByBranchAndOrder,
    displayPathSegmentByStepRunId,
    displayPathSegmentByOrder,
    currentRunDisplayStepRuns,
    derivedActiveStepRun,
    resolvedActiveBranchId,
    selectedBranchId,
    activeBranch,
    activeBranchStepRuns,
    firstUnresolvedStepId,
    openTasks,
    groupDecisions,
    groupTypeById,
    pathVisualizationData,
    branchDiffCandidates,
    defaultBranchDiffRightCandidateId,
    onBranchChange,
    selectorCollaborators,
    existingBranchStartGroupIds,
    currentRunPathMode,
    eventEditorBranch,
    branchEventEditorRows,
    eventDraftsByStepRunId,
    isReplanningBranchEvents,
    openBranchEventEditor,
    closeBranchEventEditor,
    updateBranchEventDraft,
    saveBranchEventReplan,
    handleConfirmSelection,
  };
}

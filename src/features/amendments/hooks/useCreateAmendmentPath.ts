import { useCallback } from 'react';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import type { EnrichedPathSegment } from '@/features/amendments/logic/amendmentPathHelpers';

interface CreateAmendmentPathArgs {
  amendmentId: string;
  amendmentTitle: string;
  amendmentReason: string | null;
  enrichedPath: EnrichedPathSegment[];
  workflowId?: string | null;
  pathMode?: 'hierarchy' | 'workflow';
}

/**
 * Orchestration hook that persists an amendment path with its
 * agenda items, votes, and path segments.
 *
 * Used by both the create flow (useCreateAmendmentForm) and the
 * process flow (AmendmentProcessFlow) to ensure identical path creation.
 */
export function useCreateAmendmentPath() {
  const {
    createPath,
    createPathSegment,
    createProcessRun,
    createProcessBranch,
    createProcessStepRun,
    createProcessTask,
    updateProcessRun,
    updateAmendment,
  } = useAmendmentActions();
  const { createVote } = useVoteActions();
  const { createAgendaItem } = useAgendaActions();

  const createAmendmentPath = useCallback(
    async ({
      amendmentId,
      amendmentTitle,
      amendmentReason,
      enrichedPath,
      workflowId,
      pathMode = 'hierarchy',
    }: CreateAmendmentPathArgs) => {
      if (enrichedPath.length === 0) {
        return null;
      }

      const processRunId = crypto.randomUUID();
      const branchId = crypto.randomUUID();
      const pathId = crypto.randomUUID();
      const sourceGroupId = enrichedPath[0]?.groupId ?? null;
      const targetGroupId = enrichedPath[enrichedPath.length - 1]?.groupId ?? null;
      const processStatus = enrichedPath.some(segment => !segment.eventId)
        ? 'pending_event'
        : 'scheduled';

      await createProcessRun({
        id: processRunId,
        amendment_id: amendmentId,
        root_workflow_id: workflowId ?? null,
        selected_source_group_id: sourceGroupId,
        selected_target_group_id: targetGroupId,
        selected_target_workflow_id: workflowId ?? null,
        active_branch_id: null,
        terminal_step_run_id: null,
        status: processStatus,
        evaluation_mode: null,
        evaluation_date: null,
        evaluation_offset_months: null,
        evaluation_offset_years: null,
        implementation_status: null,
      });

      await createProcessBranch({
        id: branchId,
        process_run_id: processRunId,
        parent_branch_id: null,
        merged_into_branch_id: null,
        source_step_run_id: null,
        document_version_id: null,
        title: amendmentTitle,
        status: processStatus,
        resolution: null,
      });

      // Create agenda items and votes for each segment with an event
      for (const segment of enrichedPath) {
        if (segment.eventId) {
          const agendaItemId = segment.agendaItemId ?? crypto.randomUUID();
          const voteId = segment.amendmentVoteId ?? crypto.randomUUID();

          await createAgendaItem({
            id: agendaItemId,
            title: `Amendment: ${amendmentTitle}`,
            description: amendmentReason || '',
            type: 'amendment',
            status: 'pending',
            forwarding_status: segment.forwardingStatus,
            order_index: 999,
            duration: 0,
            scheduled_time: '',
            start_time: 0,
            end_time: 0,
            activated_at: 0,
            completed_at: 0,
            event_id: segment.eventId,
            amendment_id: amendmentId,
            majority_type: null,
            time_limit: null,
            voting_phase: null,
          });

          await createVote({
            id: voteId,
            agenda_item_id: agendaItemId,
            amendment_id: amendmentId,
            title: `Amendment: ${amendmentTitle}`,
            description: amendmentReason || null,
            closing_duration_seconds: null,
            closing_end_time: null,
          });
        }
      }

      await createPath({
        id: pathId,
        amendment_id: amendmentId,
        process_run_id: processRunId,
        title: '',
        workflow_id: workflowId ?? null,
      });

      const stepRunIds: string[] = [];

      for (const [index, segment] of enrichedPath.entries()) {
        const stepRunId = crypto.randomUUID();
        const segmentStatus = segment.eventId ? 'scheduled' : 'pending_event';
        const agendaItemId = segment.eventId ? (segment.agendaItemId ?? crypto.randomUUID()) : null;
        const voteId = segment.eventId ? (segment.amendmentVoteId ?? crypto.randomUUID()) : null;

        stepRunIds.push(stepRunId);

        await createProcessStepRun({
          id: stepRunId,
          process_run_id: processRunId,
          branch_id: branchId,
          workflow_id: workflowId ?? null,
          workflow_step_id: null,
          step_kind: 'group_vote',
          selection_mode: workflowId ? 'explicit_workflow' : 'default_target_workflow',
          merge_strategy: null,
          status: segmentStatus,
          source_group_id: index === 0 ? sourceGroupId : (enrichedPath[index - 1]?.groupId ?? null),
          target_group_id: segment.groupId,
          event_id: segment.eventId ?? null,
          agenda_item_id: agendaItemId,
          vote_id: voteId,
          support_confirmation_id: null,
          decision_status: segment.forwardingStatus,
          order_index: index,
          starts_at: segment.eventStartDate ?? null,
          ends_at: null,
        });

        await createPathSegment({
          id: crypto.randomUUID(),
          path_id: pathId,
          process_branch_id: branchId,
          process_step_run_id: stepRunId,
          group_id: segment.groupId,
          event_id: segment.eventId ?? null,
          order_index: index,
          status: segment.forwardingStatus,
        });

        if (!segment.eventId) {
          await createProcessTask({
            id: crypto.randomUUID(),
            process_run_id: processRunId,
            branch_id: branchId,
            step_run_id: stepRunId,
            task_type: 'schedule_event',
            status: 'open',
            title: `Schedule amendment vote for ${segment.groupName}`,
            description: `No eligible event is selected yet for ${segment.groupName}.`,
            group_id: segment.groupId,
            target_group_id: targetGroupId,
            event_id: null,
            agenda_item_id: null,
            support_confirmation_id: null,
            due_at: null,
            resolved_at: null,
            metadata: {
              amendmentId,
              amendmentTitle,
              groupName: segment.groupName,
              orderIndex: index,
              pathMode,
              workflowId,
              forwardingStatus: segment.forwardingStatus,
            },
          });
        }
      }

      await updateProcessRun({
        id: processRunId,
        active_branch_id: branchId,
        status: processStatus,
      });

      await updateAmendment({
        id: amendmentId,
        current_process_run_id: processRunId,
      });

      return {
        processRunId,
        branchId,
        pathId,
        stepRunIds,
      };
    },
    [
      createAgendaItem,
      createPath,
      createPathSegment,
      createProcessBranch,
      createProcessRun,
      createProcessStepRun,
      createProcessTask,
      createVote,
      updateAmendment,
      updateProcessRun,
    ]
  );

  return { createAmendmentPath };
}

import { useMemo } from 'react';
import {
  useGroupAmendmentEventStepRuns as useFacadeGroupAmendmentEventStepRuns,
  useGroupAmendments as useFacadeGroupAmendments,
} from '@/zero/groups/useGroupState';
import type { GroupAmendmentEventStepRunRow, GroupAmendmentRow } from '@/zero/groups/queries';
import {
  getGroupAmendmentBadgeStatus,
  normalizeGroupAmendmentDisplayStatus,
  type GroupAmendmentBadgeStatus,
  type GroupAmendmentDisplayStatus,
} from '@/features/groups/logic/groupAmendmentStatus';

export interface GroupAmendmentListItem {
  id: string;
  amendment_id: string;
  title?: string | null;
  subtitle?: string | null;
  code?: string | null;
  decision_status?: GroupAmendmentDisplayStatus | null;
  group_status?: GroupAmendmentBadgeStatus | null;
  editing_mode?: string | null;
  date?: number | string | null;
  amendment_hashtags?: GroupAmendmentRow['amendment']['amendment_hashtags'];
  process_step_run_id?: string | null;
}

/**
 * Hook to fetch amendments for a group
 */
export function useGroupAmendments(
  groupId: string,
  eventIds: string[],
  _cursor: { after?: string; first: number } = { first: 20 }
) {
  void _cursor;
  const { amendments, isLoading } = useFacadeGroupAmendments(groupId);
  const { stepRuns, isLoading: stepRunsLoading } = useFacadeGroupAmendmentEventStepRuns(eventIds);

  const decisionItems = useMemo<GroupAmendmentListItem[]>(
    () =>
      (amendments as GroupAmendmentRow[])
        .map(decision => {
          const groupStatus = getGroupAmendmentBadgeStatus(decision.status);
          const displayStatus = normalizeGroupAmendmentDisplayStatus(decision.status);
          if (!groupStatus || !displayStatus) {
            return null;
          }

          return {
            id: decision.id,
            amendment_id: decision.amendment?.id ?? decision.amendment_id,
            title: decision.amendment?.title ?? null,
            subtitle: decision.amendment?.reason ?? null,
            code: decision.amendment?.code ?? null,
            decision_status: displayStatus,
            group_status: groupStatus,
            editing_mode: decision.amendment?.editing_mode ?? null,
            date: decision.decided_at ?? decision.updated_at ?? decision.created_at ?? null,
            amendment_hashtags: decision.amendment?.amendment_hashtags ?? [],
            process_step_run_id: decision.process_step_run_id ?? null,
          };
        })
        .filter((item): item is GroupAmendmentListItem => item !== null),
    [amendments]
  );

  const eventStepRunItems = useMemo<GroupAmendmentListItem[]>(
    () =>
      (stepRuns as GroupAmendmentEventStepRunRow[])
        .map(stepRun => {
          const amendment = stepRun.process_run?.amendment;
          const groupStatus = getGroupAmendmentBadgeStatus(stepRun.decision_status, stepRun.status);
          const displayStatus = normalizeGroupAmendmentDisplayStatus(
            stepRun.decision_status,
            stepRun.status
          );
          if (!groupStatus || !displayStatus || !stepRun.amendment_id) {
            return null;
          }

          return {
            id: `event-step:${stepRun.id}`,
            amendment_id: amendment?.id ?? stepRun.amendment_id,
            title: amendment?.title ?? null,
            subtitle: amendment?.reason ?? null,
            code: amendment?.code ?? null,
            decision_status: displayStatus,
            group_status: groupStatus,
            editing_mode: amendment?.editing_mode ?? null,
            date: stepRun.ends_at ?? stepRun.updated_at ?? stepRun.created_at ?? null,
            amendment_hashtags: amendment?.amendment_hashtags ?? [],
            process_step_run_id: stepRun.id,
          };
        })
        .filter((item): item is GroupAmendmentListItem => item !== null),
    [stepRuns]
  );

  const flattenedAmendments = useMemo<GroupAmendmentListItem[]>(() => {
    const dedupedByStepRunId = new Map<string, GroupAmendmentListItem>();
    const withoutStepRun: GroupAmendmentListItem[] = [];

    for (const item of decisionItems) {
      if (item.process_step_run_id) {
        dedupedByStepRunId.set(item.process_step_run_id, item);
      } else {
        withoutStepRun.push(item);
      }
    }

    for (const item of eventStepRunItems) {
      if (item.process_step_run_id) {
        if (!dedupedByStepRunId.has(item.process_step_run_id)) {
          dedupedByStepRunId.set(item.process_step_run_id, item);
        }
      } else {
        withoutStepRun.push(item);
      }
    }

    return [...withoutStepRun, ...dedupedByStepRunId.values()].sort((left, right) => {
      const leftDate = new Date(left.date ?? 0).getTime();
      const rightDate = new Date(right.date ?? 0).getTime();
      return rightDate - leftDate;
    });
  }, [decisionItems, eventStepRunItems]);

  return {
    amendments: flattenedAmendments,
    isLoading: isLoading || stepRunsLoading,
    error: undefined,
    pageInfo: undefined,
  };
}

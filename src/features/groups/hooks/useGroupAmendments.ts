import { useMemo } from 'react';
import { useGroupAmendments as useFacadeGroupAmendments } from '@/zero/groups/useGroupState';
import type { GroupAmendmentRow } from '@/zero/groups/queries';

export interface GroupAmendmentListItem {
  id: string;
  amendment_id: string;
  title?: string | null;
  subtitle?: string | null;
  code?: string | null;
  decision_status?: string | null;
  editing_mode?: string | null;
  date?: number | string | null;
  amendment_hashtags?: GroupAmendmentRow['amendment']['amendment_hashtags'];
}

/**
 * Hook to fetch amendments for a group
 */
export function useGroupAmendments(
  groupId: string,
  _cursor: { after?: string; first: number } = { first: 20 }
) {
  void _cursor;
  const { amendments, isLoading } = useFacadeGroupAmendments(groupId);
  const flattenedAmendments = useMemo<GroupAmendmentListItem[]>(
    () =>
      (amendments as GroupAmendmentRow[]).map(decision => ({
        id: decision.id,
        amendment_id: decision.amendment?.id ?? decision.amendment_id,
        title: decision.amendment?.title ?? null,
        subtitle: decision.amendment?.reason ?? null,
        code: decision.amendment?.code ?? null,
        decision_status: decision.status ?? null,
        editing_mode: decision.amendment?.editing_mode ?? null,
        date: decision.decided_at ?? decision.updated_at ?? decision.created_at ?? null,
        amendment_hashtags: decision.amendment?.amendment_hashtags ?? [],
      })),
    [amendments]
  );

  return {
    amendments: flattenedAmendments,
    isLoading,
    error: undefined,
    pageInfo: undefined,
  };
}

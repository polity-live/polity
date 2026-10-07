import { useMemo, useState } from 'react';
import { useQuery } from '@rocicorp/zero/react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { queries } from '@/zero/queries';

import type {
  GroupAmendmentBadgeStatus,
  GroupAmendmentDisplayStatus,
} from '../logic/groupAmendmentStatus';
import {
  getGroupAmendmentDisplayStatusForGroup,
  type GroupStatusAmendment,
} from '../logic/groupAmendmentStatus';

interface AmendmentItem {
  id: string;
  amendment_id?: string | null;
  title?: string | null;
  subtitle?: string | null;
  decision_status?: GroupAmendmentDisplayStatus | null;
  group_status?: GroupAmendmentBadgeStatus | null;
  editing_mode?: string | null;
  amendment_hashtags?: readonly { hashtag?: { id: string; tag: string } | null }[];
  branchStatuses?: {
    branchId: string;
    label: string;
    editingMode:
      | 'edit'
      | 'view'
      | 'suggest_internal'
      | 'suggest_event'
      | 'vote_internal'
      | 'event_final_closing_vote'
      | 'passed'
      | 'rejected';
    processStatus: string | null;
    resolution: string | null;
  }[];
}

type AmendmentSectionKey = GroupAmendmentDisplayStatus;
const SECTION_KEYS: AmendmentSectionKey[] = ['accepted', 'pending', 'rejected', 'withdrawn'];

interface UseAmendmentGroupsControllerProps {
  groupedAmendments: {
    accepted: AmendmentItem[];
    pending: AmendmentItem[];
    rejected: AmendmentItem[];
    withdrawn: AmendmentItem[];
  };
  groupName?: string;
  groupId?: string;
  filters?: { searchQuery: string; statusFilter: string; hashtagFilter: string };
}

export function useAmendmentGroupsController({
  groupedAmendments,
  groupName,
  groupId,
  filters,
}: UseAmendmentGroupsControllerProps) {
  const { t } = useTranslation();
  const [openSections, setOpenSections] = useState<Record<AmendmentSectionKey, boolean>>({
    accepted: true,
    pending: true,
    rejected: true,
    withdrawn: true,
  });
  const queryFilters = filters ?? { searchQuery: '', statusFilter: 'all', hashtagFilter: '' };
  const [rows] = useQuery(
    groupId
      ? queries.amendments.groupAmendmentCountRows({
          groupId,
          query: queryFilters.searchQuery,
          hashtag: queryFilters.hashtagFilter || undefined,
        })
      : null
  );
  const sectionIds = useMemo(() => {
    const ids: Record<AmendmentSectionKey, string[]> = {
      accepted: [],
      pending: [],
      rejected: [],
      withdrawn: [],
    };
    if (!groupId) return ids;
    for (const amendment of (rows ?? []) as unknown as readonly GroupStatusAmendment[]) {
      const section = getGroupAmendmentDisplayStatusForGroup(amendment, groupId);
      if (queryFilters.statusFilter === 'all' || queryFilters.statusFilter === section) {
        ids[section].push(amendment.id);
      }
    }
    return ids;
  }, [groupId, rows, queryFilters.statusFilter]);
  const sectionContexts = useMemo(
    () =>
      Object.fromEntries(
        SECTION_KEYS.map(key => [
          key,
          {
            groupId,
            displayStatus: key,
            query: queryFilters.searchQuery,
            hashtag: queryFilters.hashtagFilter,
            ids: sectionIds[key],
          },
        ])
      ) as Record<AmendmentSectionKey, object>,
    [groupId, queryFilters.searchQuery, queryFilters.hashtagFilter, sectionIds]
  );

  const sectionOrder = [
    {
      key: 'accepted' as const,
      items: groupedAmendments.accepted,
      ids: sectionIds.accepted,
      context: sectionContexts.accepted,
      count: groupId ? sectionIds.accepted.length : groupedAmendments.accepted.length,
      label: t('features.groups.common.status.acceptedApproved'),
    },
    {
      key: 'pending' as const,
      items: groupedAmendments.pending,
      ids: sectionIds.pending,
      context: sectionContexts.pending,
      count: groupId ? sectionIds.pending.length : groupedAmendments.pending.length,
      label: t('features.groups.common.status.pending'),
    },
    {
      key: 'rejected' as const,
      items: groupedAmendments.rejected,
      ids: sectionIds.rejected,
      context: sectionContexts.rejected,
      count: groupId ? sectionIds.rejected.length : groupedAmendments.rejected.length,
      label: t('features.groups.common.status.rejected'),
    },
    {
      key: 'withdrawn' as const,
      items: groupedAmendments.withdrawn,
      ids: sectionIds.withdrawn,
      context: sectionContexts.withdrawn,
      count: groupId ? sectionIds.withdrawn.length : groupedAmendments.withdrawn.length,
      label: t('features.groups.common.status.withdrawn'),
    },
  ].map(section => ({
    ...section,
    items: section.items.map(amendment => ({
      id: amendment.id,
      cardAmendment: {
        id: String(amendment.amendment_id ?? amendment.id),
        title: amendment.title ?? '',
        subtitle: groupName,
        description: amendment.subtitle ?? undefined,
        status: amendment.group_status ?? amendment.decision_status ?? 'pending',
        groupName,
        groupId,
        hashtags: extractHashtags(amendment.amendment_hashtags),
        branchStatuses: amendment.branchStatuses,
      },
    })),
  }));

  const toggleSection = (section: AmendmentSectionKey) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return {
    openSections,
    sectionOrder,
    groupId,
    groupName,
    queryFilters,
    onToggleSection: toggleSection,
  };
}

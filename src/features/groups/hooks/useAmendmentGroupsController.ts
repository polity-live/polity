import { useState } from 'react';
import { useQuery } from '@rocicorp/zero/react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { queries } from '@/zero/queries';

import type {
  GroupAmendmentBadgeStatus,
  GroupAmendmentDisplayStatus,
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

function useSectionCount(
  groupId: string | undefined,
  section: AmendmentSectionKey,
  filters: { searchQuery: string; statusFilter: string; hashtagFilter: string },
  fallbackCount: number
) {
  const enabled = !!groupId && (filters.statusFilter === 'all' || filters.statusFilter === section);
  const [rows] = useQuery(
    enabled
      ? queries.amendments.groupAmendmentCountRows({
          groupId,
          displayStatus: section,
          query: filters.searchQuery,
          hashtag: filters.hashtagFilter || undefined,
        })
      : null
  );
  return groupId ? (enabled ? (rows?.length ?? 0) : 0) : fallbackCount;
}

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
  const sectionCounts = {
    accepted: useSectionCount(groupId, 'accepted', queryFilters, groupedAmendments.accepted.length),
    pending: useSectionCount(groupId, 'pending', queryFilters, groupedAmendments.pending.length),
    rejected: useSectionCount(groupId, 'rejected', queryFilters, groupedAmendments.rejected.length),
    withdrawn: useSectionCount(
      groupId,
      'withdrawn',
      queryFilters,
      groupedAmendments.withdrawn.length
    ),
  };

  const sectionOrder = [
    {
      key: 'accepted' as const,
      items: groupedAmendments.accepted,
      count: sectionCounts.accepted,
      label: t('features.groups.common.status.acceptedApproved'),
    },
    {
      key: 'pending' as const,
      items: groupedAmendments.pending,
      count: sectionCounts.pending,
      label: t('features.groups.common.status.pending'),
    },
    {
      key: 'rejected' as const,
      items: groupedAmendments.rejected,
      count: sectionCounts.rejected,
      label: t('features.groups.common.status.rejected'),
    },
    {
      key: 'withdrawn' as const,
      items: groupedAmendments.withdrawn,
      count: sectionCounts.withdrawn,
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

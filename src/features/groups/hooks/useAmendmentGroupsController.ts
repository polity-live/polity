import { useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { extractHashtags } from '@/zero/common/hashtagHelpers';

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
}

type AmendmentSectionKey = GroupAmendmentDisplayStatus;

interface UseAmendmentGroupsControllerProps {
  groupedAmendments: {
    accepted: AmendmentItem[];
    pending: AmendmentItem[];
    rejected: AmendmentItem[];
    withdrawn: AmendmentItem[];
  };
  groupName?: string;
  groupId?: string;
}

export function useAmendmentGroupsController({
  groupedAmendments,
  groupName,
  groupId,
}: UseAmendmentGroupsControllerProps) {
  const { t } = useTranslation();
  const [openSections, setOpenSections] = useState<Record<AmendmentSectionKey, boolean>>({
    accepted: true,
    pending: true,
    rejected: true,
    withdrawn: true,
  });

  const sectionOrder = [
    {
      key: 'accepted' as const,
      items: groupedAmendments.accepted,
      label: t('features.groups.common.status.acceptedApproved'),
    },
    {
      key: 'pending' as const,
      items: groupedAmendments.pending,
      label: t('features.groups.common.status.pending'),
    },
    {
      key: 'rejected' as const,
      items: groupedAmendments.rejected,
      label: t('features.groups.common.status.rejected'),
    },
    {
      key: 'withdrawn' as const,
      items: groupedAmendments.withdrawn,
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
      },
    })),
  }));

  const toggleSection = (section: AmendmentSectionKey) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return {
    openSections,
    sectionOrder,
    onToggleSection: toggleSection,
  };
}

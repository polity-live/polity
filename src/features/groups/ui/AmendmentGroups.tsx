'use client';

import { useAmendmentGroupsController } from '@/features/groups/hooks/useAmendmentGroupsController';

import type {
  GroupAmendmentBadgeStatus,
  GroupAmendmentDisplayStatus,
} from '@/features/groups/logic/groupAmendmentStatus';
import { AmendmentGroupsView } from './AmendmentGroupsView';

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

interface AmendmentGroupsProps {
  groupedAmendments: {
    accepted: AmendmentItem[];
    pending: AmendmentItem[];
    rejected: AmendmentItem[];
    withdrawn: AmendmentItem[];
  };
  groupName?: string;
  groupId?: string;
}

export function AmendmentGroups(props: AmendmentGroupsProps) {
  return <AmendmentGroupsView {...useAmendmentGroupsController(props)} />;
}

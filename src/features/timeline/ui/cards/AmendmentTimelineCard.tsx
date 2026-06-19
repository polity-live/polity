'use client';

import { useState } from 'react';
import { Users, Building, GitPullRequest, UserPlus, UserMinus, Clock, Check } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getEditingModeOption } from '@/features/shared/ui/status';
import { useAmendmentCollaboration } from '@/features/amendments/hooks/useAmendmentCollaboration';
import { useSubscribeAmendment } from '@/features/amendments/hooks/useSubscribeAmendment';
import { normalizeTimelineText } from '@/features/timeline/logic/normalizeTimelineText';
import { CONTENT_TYPE_CONFIG } from '../../constants/content-type-config';

type AmendmentTimelineStatus =
  | 'edit'
  | 'suggest_internal'
  | 'vote_internal'
  | 'view'
  | 'suggest_event'
  | 'vote_event'
  | 'passed'
  | 'rejected'
  | 'accepted'
  | 'approved'
  | 'pending'
  | 'withdrawn';

export interface AmendmentTimelineCardProps {
  amendment: {
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    status: AmendmentTimelineStatus;
    supportPercentage?: number;
    supportCount?: number;
    opposeCount?: number;
    commentCount?: number;
    groupName?: string;
    /** Group ID for linking to group page */
    groupId?: string;
    /** Stats for collaborators count */
    collaboratorCount?: number;
    /** Stats for supporting groups count */
    supportingGroupsCount?: number;
    /** Stats for change requests count */
    changeRequestCount?: number;
    /** Hashtags for the amendment */
    hashtags?: { id: string; tag: string }[];
    /** User's collaboration status */
    collaborationStatus?: 'member' | 'admin' | 'invited' | 'requested' | null;
    /** Whether user is subscribed to this amendment */
    isSubscribed?: boolean;
  };
  /** Called when user requests collaboration */
  onRequestCollaboration?: () => void;
  /** Called when user leaves collaboration */
  onLeaveCollaboration?: () => void;
  /** Called when user accepts invitation */
  onAcceptInvitation?: () => void;
  /** Called when user withdraws request */
  onWithdrawRequest?: () => void;
  /** Called when user toggles subscription */
  onToggleSubscription?: () => void;
  /** Loading state for collaboration actions */
  isCollaborationLoading?: boolean;
  /** Loading state for subscription action */
  isSubscriptionLoading?: boolean;
  onSupport?: () => void;
  onOppose?: () => void;
  href?: string;
  className?: string;
}

/**
 * Status badge configuration
 */
const STATUS_CONFIG: Record<
  AmendmentTimelineStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  edit: { variant: 'secondary' },
  suggest_internal: { variant: 'secondary' },
  vote_internal: { variant: 'destructive' },
  view: { variant: 'outline' },
  suggest_event: { variant: 'secondary' },
  vote_event: { variant: 'destructive' },
  passed: { variant: 'default' },
  rejected: { variant: 'destructive' },
  accepted: { variant: 'default' },
  approved: { variant: 'default' },
  pending: { variant: 'secondary' },
  withdrawn: { variant: 'outline' },
};

const STATUS_LABEL_KEYS: Partial<
  Record<AmendmentTimelineStatus, { fallback: string; key: string }>
> = {
  accepted: {
    key: 'features.groups.common.status.accepted',
    fallback: 'Accepted',
  },
  approved: {
    key: 'features.groups.common.status.approved',
    fallback: 'Approved',
  },
  pending: {
    key: 'features.groups.common.status.pending',
    fallback: 'Pending',
  },
  withdrawn: {
    key: 'features.groups.common.status.withdrawn',
    fallback: 'Withdrawn',
  },
};
import { AmendmentTimelineCardView } from './AmendmentTimelineCardView';
export function AmendmentTimelineCard({
  amendment,
  onRequestCollaboration,
  onLeaveCollaboration,
  onAcceptInvitation,
  onWithdrawRequest,
  onToggleSubscription,
  isCollaborationLoading,
  isSubscriptionLoading,
  href,
  className,
}: AmendmentTimelineCardProps) {
  const { t } = useTranslation();
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const collaboration = useAmendmentCollaboration(amendment.id);
  const subscription = useSubscribeAmendment(amendment.id);
  const amendmentStyle = CONTENT_TYPE_CONFIG.amendment;
  const amendmentDescription = normalizeTimelineText(amendment.description);

  const statusConfig = STATUS_CONFIG[amendment.status] || STATUS_CONFIG.view;
  const statusLabelConfig = STATUS_LABEL_KEYS[amendment.status];
  const statusLabel = statusLabelConfig
    ? t(statusLabelConfig.key, statusLabelConfig.fallback)
    : getEditingModeOption(amendment.status, t).label;
  const isVoting = amendment.status === 'vote_internal' || amendment.status === 'vote_event';
  const isCompleted =
    amendment.status === 'passed' ||
    amendment.status === 'accepted' ||
    amendment.status === 'approved' ||
    amendment.status === 'rejected' ||
    amendment.status === 'withdrawn';

  const resolvedCollaborationStatus = amendment.collaborationStatus ?? collaboration.status;
  const isCollaborator =
    resolvedCollaborationStatus === 'member' ||
    resolvedCollaborationStatus === 'admin' ||
    collaboration.isCollaborator;
  const isInvited = resolvedCollaborationStatus === 'invited' || collaboration.isInvited;
  const hasRequested = resolvedCollaborationStatus === 'requested' || collaboration.hasRequested;

  // Get collaboration button label based on status
  const getCollaborationLabel = () => {
    if (isCollaborator) return t('features.timeline.cards.amendment.collaborator');
    if (isInvited) return t('features.timeline.cards.amendment.invited');
    if (hasRequested) return t('features.timeline.cards.amendment.pending');
    return t('features.timeline.cards.amendment.collaborate');
  };

  // Get collaboration button variant based on status
  const getCollaborationVariant = (): 'default' | 'secondary' | 'outline' => {
    if (isCollaborator) return 'secondary';
    if (isInvited) return 'default';
    if (hasRequested) return 'outline';
    return 'default';
  };

  // Get collaboration button icon
  const getCollaborationIcon = () => {
    if (isCollaborator) return UserMinus;
    if (isInvited) return Check;
    if (hasRequested) return Clock;
    return UserPlus;
  };

  const CollaborationIcon = getCollaborationIcon();

  // Build stats array
  const stats = [
    ...(amendment.collaboratorCount !== undefined && amendment.collaboratorCount > 0
      ? [
          {
            icon: Users,
            value: amendment.collaboratorCount,
            label: t('features.timeline.cards.amendment.collaborators'),
          },
        ]
      : collaboration.collaboratorCount !== undefined
        ? [
            {
              icon: Users,
              value: collaboration.collaboratorCount,
              label: t('features.timeline.cards.amendment.collaborators'),
            },
          ]
        : []),
    ...(amendment.supportingGroupsCount !== undefined && amendment.supportingGroupsCount > 0
      ? [
          {
            icon: Building,
            value: amendment.supportingGroupsCount,
            label: t('features.timeline.cards.amendment.supportingGroups'),
          },
        ]
      : []),
    ...(amendment.changeRequestCount !== undefined && amendment.changeRequestCount > 0
      ? [
          {
            icon: GitPullRequest,
            value: amendment.changeRequestCount,
            label: t('features.timeline.cards.amendment.changeRequests'),
          },
        ]
      : []),
  ];
  return (
    <AmendmentTimelineCardView
      amendment={amendment}
      onRequestCollaboration={onRequestCollaboration}
      onLeaveCollaboration={onLeaveCollaboration}
      onAcceptInvitation={onAcceptInvitation}
      onWithdrawRequest={onWithdrawRequest}
      onToggleSubscription={onToggleSubscription}
      isCollaborationLoading={isCollaborationLoading}
      isSubscriptionLoading={isSubscriptionLoading}
      href={href}
      className={className}
      t={t}
      collaborationOpen={collaborationOpen}
      setCollaborationOpen={setCollaborationOpen}
      collaboration={collaboration}
      subscription={subscription}
      amendmentStyle={amendmentStyle}
      amendmentDescription={amendmentDescription}
      statusConfig={statusConfig}
      statusLabelConfig={statusLabelConfig}
      statusLabel={statusLabel}
      isVoting={isVoting}
      isCompleted={isCompleted}
      resolvedCollaborationStatus={resolvedCollaborationStatus}
      isCollaborator={isCollaborator}
      isInvited={isInvited}
      hasRequested={hasRequested}
      getCollaborationLabel={getCollaborationLabel}
      getCollaborationVariant={getCollaborationVariant}
      getCollaborationIcon={getCollaborationIcon}
      CollaborationIcon={CollaborationIcon}
      stats={stats}
    />
  );
}

'use client';

import { useState } from 'react';
import { Users, ScrollText, Calendar, UserPlus, UserMinus, Clock, Check } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useGroupMembership } from '@/features/groups/hooks/useGroupMembership';
import { useSubscribeGroup } from '@/features/groups/hooks/useSubscribeGroup';
import { normalizeTimelineText } from '@/features/timeline/logic/normalizeTimelineText';
import type {
  ProjectedGroupMembershipState,
  ProjectedSubscriptionState,
} from '@/features/search/types/projected-card-state';

export interface GroupTimelineCardProps {
  group: {
    id: string;
    name: string;
    description?: string;
    memberCount?: number;
    eventCount?: number;
    amendmentCount?: number;
    activeDiscussions?: number;
    topics?: string[];
    hashtags?: { id: string; tag: string }[];
    /** User's membership status */
    membershipStatus?: 'active' | 'member' | 'admin' | 'invited' | 'requested' | null;
    /** Whether user is subscribed to this group */
    isSubscribed?: boolean;
  };
  /** Called when user requests membership */
  onRequestMembership?: () => void;
  /** Called when user leaves group */
  onLeave?: () => void;
  /** Called when user accepts invitation */
  onAcceptInvitation?: () => void;
  /** Called when user withdraws request */
  onWithdrawRequest?: () => void;
  /** Called when user toggles subscription */
  onToggleSubscription?: () => void;
  /** Loading state for membership actions */
  isMembershipLoading?: boolean;
  /** Loading state for subscription action */
  isSubscriptionLoading?: boolean;
  href?: string;
  className?: string;
  projectedMembershipState?: ProjectedGroupMembershipState;
  projectedSubscriptionState?: ProjectedSubscriptionState;
}
import { GroupTimelineCardView } from './GroupTimelineCardView';
export function GroupTimelineCard({
  group,
  onRequestMembership,
  onLeave,
  onAcceptInvitation,
  onWithdrawRequest,
  onToggleSubscription,
  isMembershipLoading,
  isSubscriptionLoading,
  href,
  className,
  projectedMembershipState,
  projectedSubscriptionState,
}: GroupTimelineCardProps) {
  const { t } = useTranslation();
  const [membershipOpen, setMembershipOpen] = useState(false);
  const membership = useGroupMembership(group.id, projectedMembershipState);
  const subscription = useSubscribeGroup(group.id, projectedSubscriptionState);
  const groupHashtags = group.hashtags ?? group.topics?.map(topic => ({ id: topic, tag: topic }));
  const groupDescription = normalizeTimelineText(group.description);

  const resolvedMembershipStatus = group.membershipStatus ?? membership.status;
  const isMember =
    resolvedMembershipStatus === 'active' ||
    resolvedMembershipStatus === 'member' ||
    resolvedMembershipStatus === 'admin' ||
    membership.isMember;
  const isInvited = resolvedMembershipStatus === 'invited' || membership.isInvited;
  const hasRequested = resolvedMembershipStatus === 'requested' || membership.hasRequested;
  const requestMembershipDisabled =
    !isMember && !isInvited && !hasRequested && !membership.canRequestJoin;

  // Get membership button label based on status
  const getMembershipLabel = () => {
    if (isMember) return t('features.timeline.cards.group.member');
    if (isInvited) return t('features.timeline.cards.group.invited');
    if (hasRequested) return t('features.timeline.cards.group.pending');
    return t('features.timeline.cards.group.join');
  };

  // Get membership button variant based on status
  const getMembershipVariant = (): 'default' | 'secondary' | 'outline' => {
    if (isMember) return 'secondary';
    if (isInvited) return 'default';
    if (hasRequested) return 'outline';
    return 'default';
  };

  // Get membership button icon
  const getMembershipIcon = () => {
    if (isMember) return UserMinus;
    if (isInvited) return Check;
    if (hasRequested) return Clock;
    return UserPlus;
  };

  const MembershipIcon = getMembershipIcon();

  // Build stats array
  const stats = [
    {
      icon: Users,
      value: group.memberCount ?? membership.memberCount ?? 0,
      label: t('features.timeline.cards.group.members', {
        count: group.memberCount ?? membership.memberCount ?? 0,
      }),
    },
    ...(group.eventCount !== undefined && group.eventCount > 0
      ? [
          {
            icon: Calendar,
            value: group.eventCount,
            label: t('features.timeline.cards.group.events', { count: group.eventCount }),
          },
        ]
      : []),
    ...(group.amendmentCount !== undefined && group.amendmentCount > 0
      ? [
          {
            icon: ScrollText,
            value: group.amendmentCount,
            label: t('features.timeline.cards.group.amendments', {
              count: group.amendmentCount,
            }),
          },
        ]
      : []),
  ];
  return (
    <GroupTimelineCardView
      group={group}
      onRequestMembership={onRequestMembership}
      onLeave={onLeave}
      onAcceptInvitation={onAcceptInvitation}
      onWithdrawRequest={onWithdrawRequest}
      onToggleSubscription={onToggleSubscription}
      isMembershipLoading={isMembershipLoading}
      isSubscriptionLoading={isSubscriptionLoading}
      href={href}
      className={className}
      t={t}
      membershipOpen={membershipOpen}
      setMembershipOpen={setMembershipOpen}
      membership={membership}
      subscription={subscription}
      groupHashtags={groupHashtags}
      groupDescription={groupDescription}
      isMember={isMember}
      isInvited={isInvited}
      hasRequested={hasRequested}
      requestMembershipDisabled={requestMembershipDisabled}
      getMembershipLabel={getMembershipLabel}
      getMembershipVariant={getMembershipVariant}
      MembershipIcon={MembershipIcon}
      stats={stats}
    />
  );
}

'use client';

import { cn } from '@/features/shared/utils/utils';
import { getEntityToneClasses, getHashtagToneClasses } from '@/features/shared/theme';
import { Users, Bell } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import {
  TimelineCardBase,
  TimelineCardHeader,
  TimelineCardContent,
  TimelineCardActions,
  TimelineCardBadge,
} from './TimelineCardBase';

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
}
export interface GroupTimelineCardViewProps {
  group: any;
  onRequestMembership: any;
  onLeave: any;
  onAcceptInvitation: any;
  onWithdrawRequest: any;
  onToggleSubscription: any;
  isMembershipLoading: any;
  isSubscriptionLoading: any;
  href: any;
  className: any;
  t: any;
  membershipOpen: any;
  setMembershipOpen: any;
  membership: any;
  subscription: any;
  groupHashtags: any;
  groupDescription: any;
  isMember: any;
  isInvited: any;
  hasRequested: any;
  requestMembershipDisabled: any;
  getMembershipLabel: any;
  getMembershipVariant: any;
  MembershipIcon: any;
  stats: any;
}

export function GroupTimelineCardView({
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
  t,
  membershipOpen,
  setMembershipOpen,
  membership,
  subscription,
  groupHashtags,
  groupDescription,
  isMember,
  isInvited,
  hasRequested,
  requestMembershipDisabled,
  getMembershipLabel,
  getMembershipVariant,
  MembershipIcon,
  stats,
}: GroupTimelineCardViewProps) {
  const groupTone = getEntityToneClasses('group');
  const hashtagTone = getHashtagToneClasses();
  const groupHref = href ?? `/group/${group.id}`;
  const membershipLoading = Boolean(isMembershipLoading || membership.isLoading);
  const subscriptionLoading = Boolean(isSubscriptionLoading || subscription.isLoading);
  const requestMembershipDisabledReason = membership.requestJoinDisabledReason;
  const subscriptionLoadingLabel = t('common.checks.subscription');

  return (
    <TimelineCardBase
      data-action-id="timeline.group.open"
      data-action-kind="navigation"
      contentType="group"
      className={className}
      href={groupHref}
    >
      <TimelineCardHeader
        contentType="group"
        title={group.name}
        href={groupHref}
        badge={<TimelineCardBadge label={t('features.timeline.contentTypes.group')} icon={Users} />}
      />

      <TimelineCardContent>
        <div className="mt-auto space-y-3">
          {groupDescription && (
            <p className="text-muted-foreground line-clamp-3 text-sm">{groupDescription}</p>
          )}

          {groupHashtags && groupHashtags.length > 0 && (
            <div onClick={e => e.preventDefault()}>
              <HashtagDisplay
                hashtags={groupHashtags.slice(0, 3)}
                centered={false}
                badgeClassName={hashtagTone.badge}
              />
            </div>
          )}

          {/* Stats Bar with Tooltips */}
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            {stats.map((stat: any, index: number) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <div className="flex cursor-help items-center gap-1">
                    <stat.icon className="h-3.5 w-3.5" />
                    <span className="font-medium">{stat.value}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {stat.value} {stat.label}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        {/* Membership Button with Popover */}
        <Popover open={membershipOpen} onOpenChange={setMembershipOpen}>
          <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
            <Button
              data-action-id="timeline.group.membership.menu.open"
              data-action-kind="selection"
              variant={getMembershipVariant()}
              size="sm"
              disabled={requestMembershipDisabled && !membershipLoading}
              loading={membershipLoading}
              loadingLabel={getMembershipLabel()}
              title={
                requestMembershipDisabled && !membershipLoading
                  ? requestMembershipDisabledReason
                  : undefined
              }
              className="flex items-center gap-1.5"
            >
              <MembershipIcon className="h-3.5 w-3.5" />
              <span className="text-xs">{getMembershipLabel()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              {isMember && (
                <Button
                  data-action-id="timeline.group.membership.leave"
                  data-action-kind="async-action"
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    (onLeave || membership.leaveGroup)?.();
                    setMembershipOpen(false);
                  }}
                  loading={membershipLoading}
                  loadingLabel={t('features.timeline.cards.group.leaveGroup')}
                  className="justify-start"
                >
                  {t('features.timeline.cards.group.leaveGroup')}
                </Button>
              )}
              {isInvited && (
                <>
                  <Button
                    data-action-id="timeline.group.invitation.accept"
                    data-action-kind="async-action"
                    variant="ghost"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      (onAcceptInvitation || membership.acceptInvitation)?.();
                      setMembershipOpen(false);
                    }}
                    loading={membershipLoading}
                    loadingLabel={t('features.timeline.cards.group.acceptInvitation')}
                    className="justify-start"
                  >
                    {t('features.timeline.cards.group.acceptInvitation')}
                  </Button>
                  <Button
                    data-action-id="timeline.group.invitation.reject"
                    data-action-kind="async-action"
                    variant="ghost"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      (onLeave || membership.leaveGroup)?.();
                      setMembershipOpen(false);
                    }}
                    loading={membershipLoading}
                    loadingLabel={t('features.timeline.cards.group.declineInvitation')}
                    className="text-destructive justify-start"
                  >
                    {t('features.timeline.cards.group.declineInvitation')}
                  </Button>
                </>
              )}
              {hasRequested && (
                <Button
                  data-action-id="timeline.group.request.withdraw"
                  data-action-kind="async-action"
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    (onWithdrawRequest || membership.leaveGroup)?.();
                    setMembershipOpen(false);
                  }}
                  loading={membershipLoading}
                  loadingLabel={t('features.timeline.cards.group.withdrawRequest')}
                  className="text-destructive justify-start"
                >
                  {t('features.timeline.cards.group.withdrawRequest')}
                </Button>
              )}
              {!isMember && !isInvited && !hasRequested && (
                <Button
                  data-action-id="timeline.group.membership.request"
                  data-action-kind="async-action"
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    (onRequestMembership || membership.requestJoin)?.();
                    setMembershipOpen(false);
                  }}
                  disabled={requestMembershipDisabled && !membershipLoading}
                  loading={membershipLoading}
                  loadingLabel={t('features.timeline.cards.group.requestMembership')}
                  title={
                    requestMembershipDisabled && !membershipLoading
                      ? requestMembershipDisabledReason
                      : undefined
                  }
                  className="justify-start"
                >
                  {t('features.timeline.cards.group.requestMembership')}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Subscribe Button */}
        <Button
          data-action-id="timeline.group.subscription.toggle"
          data-action-kind="async-action"
          variant={(group.isSubscribed ?? subscription.isSubscribed) ? 'outline' : 'ghost'}
          size="sm"
          onClick={e => {
            e.stopPropagation();
            (onToggleSubscription || subscription.toggleSubscribe)?.();
          }}
          loading={subscriptionLoading}
          loadingLabel={<span className="sr-only">{subscriptionLoadingLabel}</span>}
          className="flex items-center gap-1.5"
        >
          <Bell
            className={cn(
              'h-3.5 w-3.5',
              (group.isSubscribed ?? subscription.isSubscribed) && groupTone.text
            )}
          />
        </Button>

        {/* Share Button */}
        <div onClick={e => e.stopPropagation()}>
          <ShareButton
            data-action-id="timeline.group.share"
            url={groupHref}
            title={group.name}
            description={groupDescription || ''}
            variant="outline"
            size="sm"
            shareContextItem={{
              id: group.id,
              type: 'group',
              title: group.name,
              description: groupDescription,
              createdAt: new Date(),
              memberCount: group.memberCount,
              eventCount: group.eventCount,
              amendmentCount: group.amendmentCount,
              tags: groupHashtags?.map((hashtag: any) => hashtag.tag) ?? [],
              stats: {
                members: group.memberCount,
              },
            }}
          />
        </div>
      </TimelineCardActions>
    </TimelineCardBase>
  );
}

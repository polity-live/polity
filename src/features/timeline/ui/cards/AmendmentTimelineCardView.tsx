'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Link } from '@tanstack/react-router';
import { ScrollText, ThumbsUp, ThumbsDown, MessageSquare, Bell } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';
import { Progress } from '@/features/shared/ui/ui/progress';
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
  className?: string;
}
export interface AmendmentTimelineCardViewProps {
  amendment: any;
  onRequestCollaboration: any;
  onLeaveCollaboration: any;
  onAcceptInvitation: any;
  onWithdrawRequest: any;
  onToggleSubscription: any;
  isCollaborationLoading: any;
  isSubscriptionLoading: any;
  className: any;
  t: any;
  collaborationOpen: any;
  setCollaborationOpen: any;
  collaboration: any;
  subscription: any;
  amendmentStyle: any;
  amendmentDescription: any;
  statusConfig: any;
  statusLabelConfig: any;
  statusLabel: any;
  isVoting: any;
  isCompleted: any;
  resolvedCollaborationStatus: any;
  isCollaborator: any;
  isInvited: any;
  hasRequested: any;
  getCollaborationLabel: any;
  getCollaborationVariant: any;
  getCollaborationIcon: any;
  CollaborationIcon: any;
  stats: any;
}

export function AmendmentTimelineCardView({
  amendment,
  onRequestCollaboration,
  onLeaveCollaboration,
  onAcceptInvitation,
  onWithdrawRequest,
  onToggleSubscription,
  isCollaborationLoading,
  isSubscriptionLoading,
  className,
  t,
  collaborationOpen,
  setCollaborationOpen,
  collaboration,
  subscription,
  amendmentStyle,
  amendmentDescription,
  statusConfig,
  statusLabel,
  isVoting,
  isCompleted,
  isCollaborator,
  isInvited,
  hasRequested,
  getCollaborationLabel,
  getCollaborationVariant,
  CollaborationIcon,
  stats,
}: AmendmentTimelineCardViewProps) {
  return (
    <TimelineCardBase
      contentType="amendment"
      className={className}
      href={`/amendment/${amendment.id}`}
    >
      <TimelineCardHeader
        contentType="amendment"
        title={amendment.title}
        href={`/amendment/${amendment.id}`}
        subtitle={amendment.groupName}
        subtitleHref={amendment.groupId ? `/group/${amendment.groupId}` : undefined}
        badge={
          <TimelineCardBadge
            label={t('features.timeline.contentTypes.amendment')}
            icon={ScrollText}
          />
        }
      >
        {/* Status Badge */}
        <div className="mt-2 flex justify-center">
          <BadgeControl
            variant={statusConfig.variant}
            className={cn('px-3 py-1 text-xs', isVoting && 'animate-pulse')}
          >
            {statusLabel}
          </BadgeControl>
        </div>
      </TimelineCardHeader>

      <TimelineCardContent>
        <div className="mt-auto space-y-3">
          {amendmentDescription && (
            <p className="text-muted-foreground line-clamp-3 text-sm">{amendmentDescription}</p>
          )}

          {/* Hashtags */}
          {amendment.hashtags && amendment.hashtags.length > 0 && (
            <div onClick={e => e.stopPropagation()}>
              <HashtagDisplay
                hashtags={amendment.hashtags.slice(0, 3)}
                centered={false}
                badgeClassName={cn(
                  featureThemeClassName('timelineAmendmentTimelineCardNeutralContrastSurface'),
                  amendmentStyle.borderColor,
                  amendmentStyle.accentColor
                )}
              />
            </div>
          )}

          {/* Vote Progress Bar */}
          {(isVoting || isCompleted) && amendment.supportPercentage !== undefined && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {t('features.timeline.cards.support')}
                </span>
                <span
                  className={cn(
                    'font-medium',
                    amendment.supportPercentage >= 50
                      ? featureThemeClassName('timelineUseTodoTimelineCardSuccessText')
                      : featureThemeClassName('timelineUseTodoTimelineCardDangerText')
                  )}
                >
                  {amendment.supportPercentage}%
                </span>
              </div>
              <Progress
                value={amendment.supportPercentage}
                className={cn(
                  'h-2',
                  (amendment.status === 'passed' ||
                    amendment.status === 'accepted' ||
                    amendment.status === 'approved') &&
                    featureThemeClassName('timelineTodoTimelineCardSuccessProgressFill'),
                  amendment.status === 'rejected' &&
                    featureThemeClassName('timelineVoteTimelineCardDangerProgressFill')
                )}
              />
            </div>
          )}

          {/* Stats Bar with Tooltips */}
          {stats.length > 0 && (
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
          )}

          {/* Vote Counts (for voting mode) */}
          {(isVoting || isCompleted) && (
            <div className="text-muted-foreground flex items-center gap-4 text-xs">
              {amendment.supportCount !== undefined && (
                <div className="flex items-center gap-1">
                  <ThumbsUp
                    className={featureThemeClassName('timelineAmendmentTimelineCardSuccessIcon')}
                  />
                  <span>{amendment.supportCount}</span>
                </div>
              )}
              {amendment.opposeCount !== undefined && (
                <div className="flex items-center gap-1">
                  <ThumbsDown
                    className={featureThemeClassName('timelineAmendmentTimelineCardDangerIcon')}
                  />
                  <span>{amendment.opposeCount}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        {/* Collaboration Button with Popover */}
        <Popover open={collaborationOpen} onOpenChange={setCollaborationOpen}>
          <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
            <Button
              variant={getCollaborationVariant()}
              size="sm"
              disabled={isCollaborationLoading || collaboration.isLoading}
              className="flex items-center gap-1.5"
            >
              <CollaborationIcon className="h-3.5 w-3.5" />
              <span className="text-xs">{getCollaborationLabel()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              {isCollaborator && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    (onLeaveCollaboration || collaboration.leaveCollaboration)?.();
                    setCollaborationOpen(false);
                  }}
                  disabled={isCollaborationLoading || collaboration.isLoading}
                  className="justify-start"
                >
                  {t('features.timeline.cards.amendment.leaveCollaboration')}
                </Button>
              )}
              {isInvited && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      (onAcceptInvitation || collaboration.acceptInvitation)?.();
                      setCollaborationOpen(false);
                    }}
                    disabled={isCollaborationLoading || collaboration.isLoading}
                    className="justify-start"
                  >
                    {t('features.timeline.cards.amendment.acceptInvitation')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      (onLeaveCollaboration || collaboration.leaveCollaboration)?.();
                      setCollaborationOpen(false);
                    }}
                    disabled={isCollaborationLoading || collaboration.isLoading}
                    className="text-destructive justify-start"
                  >
                    {t('features.timeline.cards.amendment.declineInvitation')}
                  </Button>
                </>
              )}
              {hasRequested && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    (onWithdrawRequest || collaboration.leaveCollaboration)?.();
                    setCollaborationOpen(false);
                  }}
                  disabled={isCollaborationLoading || collaboration.isLoading}
                  className="text-destructive justify-start"
                >
                  {t('features.timeline.cards.amendment.withdrawRequest')}
                </Button>
              )}
              {!isCollaborator && !isInvited && !hasRequested && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    (onRequestCollaboration || collaboration.requestCollaboration)?.();
                    setCollaborationOpen(false);
                  }}
                  disabled={isCollaborationLoading || collaboration.isLoading}
                  className="justify-start"
                >
                  {t('features.timeline.cards.amendment.requestCollaboration')}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Discuss Button (links to discussion page) */}
        <Button variant="outline" size="sm" asChild className="flex items-center gap-1.5">
          <Link
            to="/amendment/$id/discussions"
            params={{ id: amendment.id }}
            onClick={e => e.stopPropagation()}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="text-xs">{t('features.timeline.cards.discuss')}</span>
          </Link>
        </Button>

        {/* Subscribe Button */}
        <Button
          variant={(amendment.isSubscribed ?? subscription.isSubscribed) ? 'outline' : 'ghost'}
          size="sm"
          onClick={e => {
            e.stopPropagation();
            (onToggleSubscription || subscription.toggleSubscribe)?.();
          }}
          disabled={isSubscriptionLoading || subscription.isLoading}
          className="flex items-center gap-1.5"
        >
          <Bell
            className={`h-3.5 w-3.5 ${(amendment.isSubscribed ?? subscription.isSubscribed) ? featureThemeClassName('timelineActionBarThemedStyle') : ''}`}
          />
        </Button>

        {/* Share Button */}
        <div onClick={e => e.stopPropagation()}>
          <ShareButton
            url={`/amendment/${amendment.id}`}
            title={amendment.title}
            description={amendmentDescription || ''}
            variant="outline"
            size="sm"
            shareContextItem={{
              id: amendment.id,
              type: 'amendment',
              title: amendment.title,
              description: amendmentDescription,
              createdAt: new Date(),
              status: amendment.status,
              groupId: amendment.groupId,
              groupName: amendment.groupName,
              collaboratorCount: amendment.collaboratorCount,
              supportingGroupsCount: amendment.supportingGroupsCount,
              changeRequestCount: amendment.changeRequestCount,
              tags: amendment.hashtags?.map((hashtag: any) => hashtag.tag) ?? [],
            }}
          />
        </div>
      </TimelineCardActions>
    </TimelineCardBase>
  );
}

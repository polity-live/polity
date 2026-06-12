'use client';

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ScrollText,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Users,
  Building,
  GitPullRequest,
  UserPlus,
  UserMinus,
  Clock,
  Check,
  Bell,
} from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { getEditingModeOption } from '@/features/shared/ui/ui/editing-mode.tsx';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { HashtagDisplay } from '@/features/shared/ui/ui/hashtag-display';
import { useAmendmentCollaboration } from '@/features/amendments/hooks/useAmendmentCollaboration';
import { useSubscribeAmendment } from '@/features/amendments/hooks/useSubscribeAmendment';
import { normalizeTimelineText } from '@/features/timeline/logic/normalizeTimelineText';
import { CONTENT_TYPE_CONFIG } from '../../constants/content-type-config';
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

/**
 * AmendmentTimelineCard - The Proposal card
 *
 * Displays an amendment with:
 * - Purple-blue gradient header
 * - Clickable card that navigates to amendment page
 * - Clickable group name subtitle
 * - Status badge (Editing, Voting, Passed, etc.)
 * - Title and description
 * - Hashtags
 * - Stats bar with tooltips (collaborators, groups, change requests)
 * - Vote progress bar (when in voting status)
 * - Collaboration button with popover
 * - Discuss button (links to discussion page)
 * - Share button
 * - Subscribe button
 */
export function AmendmentTimelineCard({
  amendment,
  onRequestCollaboration,
  onLeaveCollaboration,
  onAcceptInvitation,
  onWithdrawRequest,
  onToggleSubscription,
  isCollaborationLoading,
  isSubscriptionLoading,
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
          <Badge
            variant={statusConfig.variant}
            className={cn('px-3 py-1 text-xs', isVoting && 'animate-pulse')}
          >
            {statusLabel}
          </Badge>
        </div>
      </TimelineCardHeader>

      <TimelineCardContent>
        {amendmentDescription && (
          <p className="text-muted-foreground mb-3 line-clamp-3 text-sm">{amendmentDescription}</p>
        )}

        {/* Hashtags */}
        {amendment.hashtags && amendment.hashtags.length > 0 && (
          <div className="mb-3" onClick={e => e.stopPropagation()}>
            <HashtagDisplay
              hashtags={amendment.hashtags.slice(0, 3)}
              centered={false}
              badgeClassName={`border bg-white/70 dark:bg-gray-900/60 ${amendmentStyle.borderColor} ${amendmentStyle.accentColor}`}
            />
          </div>
        )}

        {/* Vote Progress Bar */}
        {(isVoting || isCompleted) && amendment.supportPercentage !== undefined && (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('features.timeline.cards.support')}</span>
              <span
                className={cn(
                  'font-medium',
                  amendment.supportPercentage >= 50 ? 'text-green-600' : 'text-red-600'
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
                  '[&>div]:bg-green-500',
                amendment.status === 'rejected' && '[&>div]:bg-red-500'
              )}
            />
          </div>
        )}

        {/* Stats Bar with Tooltips */}
        {stats.length > 0 && (
          <div className="text-muted-foreground mb-3 flex items-center gap-4 text-xs">
            {stats.map((stat, index) => (
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
                <ThumbsUp className="h-3.5 w-3.5 text-green-600" />
                <span>{amendment.supportCount}</span>
              </div>
            )}
            {amendment.opposeCount !== undefined && (
              <div className="flex items-center gap-1">
                <ThumbsDown className="h-3.5 w-3.5 text-red-600" />
                <span>{amendment.opposeCount}</span>
              </div>
            )}
          </div>
        )}
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
            className={`h-3.5 w-3.5 ${(amendment.isSubscribed ?? subscription.isSubscribed) ? 'fill-current' : ''}`}
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
              tags: amendment.hashtags?.map(hashtag => hashtag.tag) ?? [],
            }}
          />
        </div>
      </TimelineCardActions>
    </TimelineCardBase>
  );
}

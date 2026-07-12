'use client';

import {
  getEntityToneClasses,
  getHashtagToneClasses,
  getMotionPreset,
  getSemanticToneClasses,
} from '@/features/shared/theme';
import { BadgeControl, getEditingModeOption } from '@/features/shared/ui/status';
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
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';

type AmendmentTimelineStatus = EditingMode | 'accepted' | 'approved' | 'pending' | 'withdrawn';

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
export interface AmendmentTimelineCardViewProps {
  amendment: any;
  onRequestCollaboration: any;
  onLeaveCollaboration: any;
  onAcceptInvitation: any;
  onWithdrawRequest: any;
  onToggleSubscription: any;
  isCollaborationLoading: any;
  isSubscriptionLoading: any;
  href: any;
  className: any;
  t: any;
  collaborationOpen: any;
  setCollaborationOpen: any;
  collaboration: any;
  subscription: any;
  amendmentDescription: any;
  statusConfig: any;
  statusLabel: any;
  isVoting: any;
  isCompleted: any;
  isCollaborator: any;
  isInvited: any;
  hasRequested: any;
  getCollaborationLabel: any;
  getCollaborationVariant: any;
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
  href,
  className,
  t,
  collaborationOpen,
  setCollaborationOpen,
  collaboration,
  subscription,
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
  const amendmentTone = getEntityToneClasses('amendment');
  const hashtagTone = getHashtagToneClasses();
  const successTone = getSemanticToneClasses('success');
  const dangerTone = getSemanticToneClasses('danger');
  const amendmentHref = href ?? `/amendment/${amendment.id}`;
  const collaborationLoading = Boolean(isCollaborationLoading || collaboration.isLoading);
  const subscriptionLoading = Boolean(isSubscriptionLoading || subscription.isLoading);
  const subscriptionLoadingLabel = t('common.checks.subscription');
  const branchStatuses = (
    Array.isArray(amendment.branchStatuses) ? amendment.branchStatuses : []
  ) as {
    branchId: string;
    editingMode: EditingMode;
    label: string;
  }[];
  const visibleBranchStatuses = branchStatuses.slice(0, 3);
  const hiddenBranchStatuses = branchStatuses.slice(3);
  const getBranchChipVariant = (
    mode: EditingMode
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (mode === 'vote_internal' || mode === 'event_final_closing_vote' || mode === 'rejected') {
      return 'destructive';
    }
    if (mode === 'passed') return 'default';
    if (mode === 'view') return 'outline';
    return 'secondary';
  };
  const getBranchChipText = (branchStatus: { editingMode: EditingMode; label: string }) =>
    `${branchStatus.label}: ${getEditingModeOption(branchStatus.editingMode, t).label}`;

  return (
    <TimelineCardBase contentType="amendment" className={className} href={amendmentHref}>
      <TimelineCardHeader
        contentType="amendment"
        title={amendment.title}
        href={amendmentHref}
        subtitle={amendment.groupName}
        subtitleHref={amendment.groupId ? `/group/${amendment.groupId}` : undefined}
        badge={
          <TimelineCardBadge
            label={t('features.timeline.contentTypes.amendment')}
            icon={ScrollText}
          />
        }
      >
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {visibleBranchStatuses.length > 0 ? (
            <>
              {visibleBranchStatuses.map((branchStatus: any) => (
                <BadgeControl
                  key={branchStatus.branchId}
                  variant={getBranchChipVariant(branchStatus.editingMode)}
                  className={cn(
                    'max-w-44 px-2.5 py-1 text-xs',
                    (branchStatus.editingMode === 'vote_internal' ||
                      branchStatus.editingMode === 'event_final_closing_vote') &&
                      getMotionPreset('attention')
                  )}
                >
                  <span className="truncate">{getBranchChipText(branchStatus)}</span>
                </BadgeControl>
              ))}
              {hiddenBranchStatuses.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BadgeControl variant="outline" className="px-2.5 py-1 text-xs">
                      +{hiddenBranchStatuses.length}
                    </BadgeControl>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1 text-xs">
                      {hiddenBranchStatuses.map((branchStatus: any) => (
                        <div key={branchStatus.branchId}>{getBranchChipText(branchStatus)}</div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : (
            <BadgeControl
              variant={statusConfig.variant}
              className={cn('px-3 py-1 text-xs', isVoting && getMotionPreset('attention'))}
            >
              {statusLabel}
            </BadgeControl>
          )}
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
                badgeClassName={hashtagTone.badge}
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
                    amendment.supportPercentage >= 50 ? successTone.text : dangerTone.text
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
                    '[&>div]:bg-[var(--badge-success-fg)]',
                  amendment.status === 'rejected' && '[&>div]:bg-[var(--badge-danger-fg)]',
                  !['passed', 'accepted', 'approved', 'rejected'].includes(amendment.status) &&
                    '[&>div]:bg-[var(--entity-amendment-base)]'
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
                  <ThumbsUp className={cn('h-3.5 w-3.5', successTone.text)} />
                  <span>{amendment.supportCount}</span>
                </div>
              )}
              {amendment.opposeCount !== undefined && (
                <div className="flex items-center gap-1">
                  <ThumbsDown className={cn('h-3.5 w-3.5', dangerTone.text)} />
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
              loading={collaborationLoading}
              loadingLabel={getCollaborationLabel()}
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
                  loading={collaborationLoading}
                  loadingLabel={t('features.timeline.cards.amendment.leaveCollaboration')}
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
                    loading={collaborationLoading}
                    loadingLabel={t('features.timeline.cards.amendment.acceptInvitation')}
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
                    loading={collaborationLoading}
                    loadingLabel={t('features.timeline.cards.amendment.declineInvitation')}
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
                  loading={collaborationLoading}
                  loadingLabel={t('features.timeline.cards.amendment.withdrawRequest')}
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
                  loading={collaborationLoading}
                  loadingLabel={t('features.timeline.cards.amendment.requestCollaboration')}
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
          loading={subscriptionLoading}
          loadingLabel={<span className="sr-only">{subscriptionLoadingLabel}</span>}
          className="flex items-center gap-1.5"
        >
          <Bell
            className={cn(
              'h-3.5 w-3.5',
              (amendment.isSubscribed ?? subscription.isSubscribed) && amendmentTone.text
            )}
          />
        </Button>

        {/* Share Button */}
        <div onClick={e => e.stopPropagation()}>
          <ShareButton
            url={amendmentHref}
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

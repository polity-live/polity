'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Video, Play, Eye, User } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import {
  TimelineCardBase,
  TimelineCardContent,
  TimelineCardActions,
  TimelineCardActionButton,
} from './TimelineCardBase';

export interface VideoTimelineCardProps {
  video: {
    id: string;
    title: string;
    thumbnailUrl?: string;
    duration?: number; // in seconds
    views?: number;
    likes?: number;
    authorName?: string;
    authorAvatar?: string;
    sourceType?: 'amendment' | 'user' | 'group' | 'event' | 'blog' | 'statement';
    sourceName?: string;
    sourceId?: string;
    videoUrl?: string;
    amendmentId?: string;
    isLiked?: boolean;
  };
  onPlay?: () => void;
  onLike?: () => void;
  onShare?: () => void;
  className?: string;
}

/**
 * Format duration from seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format view count for display
 */
function formatViews(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

/**
 * Get source type label
 */
const SOURCE_LABELS: Record<string, string> = {
  amendment: 'Amendment Explainer',
  user: 'User Video',
  group: 'Group Video',
  event: 'Event Recording',
  blog: 'Blog Video',
  statement: 'Statement Video',
};

export interface VideoTimelineCardViewProps {
  video: any;
  onPlay: any;
  className: any;
  t: any;
  playerOpen: any;
  setPlayerOpen: any;
  sourceHref: any;
  amendmentHref: any;
  targetHref: any;
}

export function VideoTimelineCardView({
  video,
  onPlay,
  className,
  t,
  playerOpen,
  setPlayerOpen,
  targetHref,
}: VideoTimelineCardViewProps) {
  return (
    <TimelineCardBase contentType="video" className={className} href={targetHref}>
      {/* Video Thumbnail */}
      <div
        className="group bg-muted relative aspect-video shrink-0 cursor-pointer"
        data-timeline-card-media
        onClick={e => {
          e.preventDefault();
          setPlayerOpen(true);
          onPlay?.();
        }}
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className={featureThemeClassName(
              'timelineVideoTimelineCardDangerAccentGradientSurface'
            )}
          >
            <Video className="text-muted-foreground h-12 w-12" />
          </div>
        )}

        {/* Play Button Overlay */}
        <div className={featureThemeClassName('timelineVideoTimelineCardContrastBackground')}>
          <div className={featureThemeClassName('timelineVideoTimelineCardContrastPanel')}>
            <Play className={featureThemeClassName('timelineVideoTimelineCardNeutralIcon')} />
          </div>
        </div>

        {/* Duration Badge */}
        {video.duration && (
          <BadgeControl
            variant="secondary"
            className={featureThemeClassName('timelineVideoTimelineCardContrastBackgroundAlpha')}
          >
            {formatDuration(video.duration)}
          </BadgeControl>
        )}

        {/* Source Badge */}
        {video.sourceType && (
          <BadgeControl
            variant="outline"
            className={featureThemeClassName('timelineImageTimelineCardNeutralContrastBackground')}
          >
            {SOURCE_LABELS[video.sourceType] || video.sourceType}
          </BadgeControl>
        )}
      </div>

      <TimelineCardContent>
        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-sm font-semibold">
          {targetHref ? (
            <SmartLink
              href={targetHref}
              onClick={event => event.stopPropagation()}
              className="hover:underline"
            >
              {video.title}
            </SmartLink>
          ) : (
            video.title
          )}
        </h3>

        <div className="mt-auto space-y-3">
          {/* Author Info */}
          {(video.authorName || video.sourceName) && (
            <div className="flex items-center gap-2">
              {video.authorAvatar ? (
                <img
                  src={video.authorAvatar}
                  alt={video.authorName}
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <div className="bg-muted flex h-5 w-5 items-center justify-center rounded-full">
                  <User className="h-3 w-3" />
                </div>
              )}
              <span className="text-muted-foreground truncate text-xs">
                {video.authorName}
                {video.sourceName && <span> · {video.sourceName}</span>}
              </span>
            </div>
          )}

          {/* Stats */}
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            {video.views !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-help items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {formatViews(video.views)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {video.views} {t('features.timeline.cards.views')}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        <TimelineCardActionButton
          icon={Play}
          label={t('features.timeline.cards.play')}
          onClick={e => {
            e?.preventDefault();
            setPlayerOpen(true);
            onPlay?.();
          }}
          variant="default"
        />
        <div onClick={e => e.preventDefault()}>
          <ShareButton
            url={targetHref || `/video/${video.id}`}
            title={video.title}
            description={video.sourceName || ''}
            variant="outline"
            size="sm"
          />
        </div>
      </TimelineCardActions>

      <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
        <ScrollableDialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{video.title}</DialogTitle>
          </DialogHeader>
          <div className={featureThemeClassName('timelineVideoTimelineCardContrastBackgroundBeta')}>
            {video.videoUrl ? (
              <video src={video.videoUrl} controls autoPlay className="h-full w-full" />
            ) : (
              <div className="text-muted-foreground flex h-full w-full items-center justify-center text-sm">
                {t('features.timeline.cards.videoUnavailable')}
              </div>
            )}
          </div>
        </ScrollableDialogContent>
      </Dialog>
    </TimelineCardBase>
  );
}

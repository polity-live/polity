'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Image as ImageIcon, MapPin, User, Heart, MessageSquare } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { TimelineCardBase, TimelineCardContent, TimelineCardActions } from './TimelineCardBase';

export interface ImageTimelineCardProps {
  image: {
    id: string;
    imageUrl: string;
    caption?: string;
    location?: string;
    likes?: number;
    comments?: number;
    authorName?: string;
    authorAvatar?: string;
    sourceType?: 'user' | 'group' | 'event' | 'amendment' | 'blog' | 'statement';
    sourceName?: string;
    sourceId?: string;
    isLiked?: boolean;
  };
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onImageClick?: () => void;
  href?: string;
  className?: string;
}

/**
 * Format count for display
 */
function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Get source type label
 */
const SOURCE_LABELS: Record<string, string> = {
  user: 'User Photo',
  group: 'Group Photo',
  event: 'Event Photo',
  amendment: 'Amendment Image',
  blog: 'Blog Image',
  statement: 'Statement Image',
};

/**
 * ImageTimelineCard - The Snapshot card
 *
 * Displays an image with:
 * - Full image filling the card
 * - Gradient overlay with caption
 * - Location tag (if available)
 * - Author info
 * - Like and comment counts
 * - Actions: Like, Comment, Share
 */
export function ImageTimelineCard({
  image,
  onImageClick,
  href,
  className,
}: ImageTimelineCardProps) {
  const { t } = useTranslation();
  const sourceHref =
    href ??
    (image.sourceType && image.sourceId ? `/${image.sourceType}/${image.sourceId}` : undefined);

  return (
    <TimelineCardBase contentType="image" className={className} href={sourceHref}>
      {/* Image Container */}
      <div
        className="group relative shrink-0 cursor-pointer"
        data-timeline-card-media
        onClick={onImageClick}
      >
        <img
          src={image.imageUrl}
          alt={image.caption || 'Image'}
          className="w-full object-cover"
          loading="lazy"
          style={{ minHeight: '200px', maxHeight: '400px' }}
        />

        {/* Gradient Overlay with Caption */}
        <div className={featureThemeClassName('timelineImageTimelineCardContrastGradientSurface')}>
          {image.caption && (
            <div className="mb-2 flex items-start gap-2">
              <ImageIcon
                className={featureThemeClassName('timelineImageTimelineCardContrastIcon')}
              />
              <p className={featureThemeClassName('timelineImageTimelineCardContrastText')}>
                {image.caption}
              </p>
            </div>
          )}

          {image.location && (
            <div className={featureThemeClassName('timelineImageTimelineCardContrastTextAlpha')}>
              <MapPin className="h-3 w-3" />
              <span>{image.location}</span>
            </div>
          )}
        </div>

        {/* Source Badge */}
        {image.sourceType && (
          <BadgeControl
            variant="outline"
            className={featureThemeClassName('timelineImageTimelineCardNeutralContrastBackground')}
          >
            {SOURCE_LABELS[image.sourceType] || image.sourceType}
          </BadgeControl>
        )}
      </div>

      <TimelineCardContent>
        <div className="mt-auto space-y-3">
          {/* Author Info */}
          {(image.authorName || image.sourceName) && (
            <div className="flex items-center gap-2">
              {image.authorAvatar ? (
                <img
                  src={image.authorAvatar}
                  alt={image.authorName}
                  className="h-5 w-5 rounded-md object-cover"
                />
              ) : (
                <div className="bg-muted flex h-5 w-5 items-center justify-center rounded-md">
                  <User className="h-3 w-3" />
                </div>
              )}
              <span className="text-muted-foreground text-xs">
                {t('features.timeline.cards.postedBy')} {image.authorName || image.sourceName}
              </span>
            </div>
          )}

          {/* Stats Bar with Tooltips */}
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            {image.likes !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-help items-center gap-1">
                    <Heart className="h-3.5 w-3.5" />
                    {formatCount(image.likes)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {image.likes} {t('features.timeline.cards.likes')}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {image.comments !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-help items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {formatCount(image.comments)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {image.comments} {t('features.timeline.cards.comments')}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        <div onClick={e => e.preventDefault()}>
          <ShareButton
            url={sourceHref || `/image/${image.id}`}
            title={image.caption || t('features.timeline.contentTypes.image')}
            description={image.location || ''}
            variant="outline"
            size="sm"
          />
        </div>
      </TimelineCardActions>
    </TimelineCardBase>
  );
}

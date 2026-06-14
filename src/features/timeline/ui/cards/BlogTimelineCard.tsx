'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BookOpen, Clock, User, Bell, Users, MessageSquare } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { useSubscribeBlog } from '@/features/blogs/hooks/useSubscribeBlog';
import { Button } from '@/features/shared/ui/ui/button';
import { CONTENT_TYPE_CONFIG, getContentTypeGradient } from '../../constants/content-type-config';
import {
  TimelineCardBase,
  TimelineCardContent,
  TimelineCardActions,
  TimelineCardBadge,
} from './TimelineCardBase';

export interface BlogTimelineCardProps {
  blog: {
    id: string;
    title: string;
    excerpt?: string;
    coverImageUrl?: string;
    readingTimeMinutes?: number;
    authorName?: string;
    authorAvatar?: string;
    authorId?: string;
    groupId?: string | null;
    publishedAt?: string | Date;
    readProgress?: number; // 0-100, how much user has read
    commentCount?: number;
    hashtags?: { id: string; tag: string }[];
  };
  onShare?: () => void;
  className?: string;
}

/**
 * Format reading time for display
 */
function formatReadingTime(minutes: number): string {
  if (minutes < 1) return '< 1 min read';
  return `${minutes} min read`;
}

/**
 * BlogTimelineCard - The Long Read card
 *
 * Displays a blog post with:
 * - Clickable card that navigates to blog page
 * - Featured/cover image (if available)
 * - Teal-green gradient header (if no cover image)
 * - Title (large)
 * - Excerpt
 * - Author info
 * - Reading time
 * - Reading progress (if user has started)
 * - Actions: Subscribe, Share
 */
export function BlogTimelineCard({ blog, className }: BlogTimelineCardProps) {
  const { t } = useTranslation();
  const gradient = getContentTypeGradient('blog');
  const subscription = useSubscribeBlog(blog.id);
  const blogStyle = CONTENT_TYPE_CONFIG.blog;

  const blogUrl = blog.groupId
    ? `/group/${blog.groupId}/blog/${blog.id}`
    : blog.authorId
      ? `/user/${blog.authorId}/blog/${blog.id}`
      : `/blog/${blog.id}`;

  const stats = [
    {
      icon: Users,
      value: subscription.subscriberCount ?? 0,
      label: t('features.timeline.cards.subscribers'),
    },
    ...(blog.commentCount !== undefined
      ? [
          {
            icon: MessageSquare,
            value: blog.commentCount,
            label: t('features.timeline.cards.comments'),
          },
        ]
      : []),
  ];

  return (
    <TimelineCardBase contentType="blog" className={className} href={blogUrl}>
      {/* Cover Image or Gradient Header */}
      {blog.coverImageUrl ? (
        <div className="relative aspect-video shrink-0" data-timeline-card-media>
          <img
            src={blog.coverImageUrl}
            alt={blog.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div
            className={featureThemeClassName('timelineBlogTimelineCardContrastGradientSurface')}
          />

          {/* Title Overlay */}
          <div className="absolute right-0 bottom-0 left-0 p-4">
            <h3 className={featureThemeClassName('timelineBlogTimelineCardContrastText')}>
              <Link to={blogUrl} onClick={e => e.stopPropagation()} className="hover:underline">
                {blog.title}
              </Link>
            </h3>
          </div>
        </div>
      ) : (
        <div className={cn('shrink-0 p-4', gradient)}>
          <div className="mb-2 flex items-start gap-2">
            <BookOpen className={featureThemeClassName('timelineBlogTimelineCardTealIcon')} />
            <TimelineCardBadge label={t('features.timeline.contentTypes.blog')} icon={BookOpen} />
          </div>
          <h3 className="line-clamp-2 text-lg leading-tight font-bold">
            <Link to={blogUrl} onClick={e => e.stopPropagation()} className="hover:underline">
              {blog.title}
            </Link>
          </h3>
        </div>
      )}

      <TimelineCardContent className={blog.coverImageUrl ? undefined : 'pt-0'}>
        {/* Title (if there's a cover image, it's in the overlay) */}
        {blog.coverImageUrl && (
          <h3 className="mb-2 line-clamp-2 text-base leading-tight font-bold">
            <Link to={blogUrl} onClick={e => e.stopPropagation()} className="hover:underline">
              {blog.title}
            </Link>
          </h3>
        )}

        <div className="mt-auto space-y-3">
          {/* Excerpt */}
          {blog.excerpt && (
            <p className="text-muted-foreground line-clamp-3 text-sm">{blog.excerpt}</p>
          )}

          {/* Hashtags */}
          {blog.hashtags && blog.hashtags.length > 0 && (
            <div onClick={e => e.preventDefault()}>
              <HashtagDisplay
                hashtags={blog.hashtags.slice(0, 3)}
                centered={false}
                badgeClassName={cn(
                  featureThemeClassName('timelineAmendmentTimelineCardNeutralContrastSurface'),
                  blogStyle.borderColor,
                  blogStyle.accentColor
                )}
              />
            </div>
          )}

          {/* Author Info */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={blog.authorAvatar} alt={blog.authorName} />
              <AvatarFallback>
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs">
              {t('features.timeline.cards.by')} {blog.authorName}
            </span>
          </div>

          {/* Reading Time */}
          {blog.readingTimeMinutes && (
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatReadingTime(blog.readingTimeMinutes)}</span>
            </div>
          )}

          {/* Reading Progress */}
          {blog.readProgress !== undefined && blog.readProgress > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {t('features.timeline.cards.readProgress')}
                </span>
                <span className="font-medium">{blog.readProgress}%</span>
              </div>
              <Progress value={blog.readProgress} className="h-1" />
            </div>
          )}

          {/* Stats Bar with Tooltips */}
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
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
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        {/* Subscribe Button */}
        <Button
          variant={subscription.isSubscribed ? 'outline' : 'ghost'}
          size="sm"
          onClick={e => {
            e.preventDefault();
            subscription.toggleSubscribe();
          }}
          disabled={subscription.isLoading}
          className="flex items-center gap-1.5"
        >
          <Bell
            className={`h-3.5 w-3.5 ${subscription.isSubscribed ? featureThemeClassName('timelineActionBarThemedStyle') : ''}`}
          />
        </Button>

        {/* Share Button */}
        <div onClick={e => e.preventDefault()}>
          <ShareButton
            url={blogUrl}
            title={blog.title}
            description={blog.excerpt || ''}
            variant="outline"
            size="sm"
            shareContextItem={{
              id: blog.id,
              type: 'blog',
              title: blog.title,
              description: blog.excerpt,
              imageUrl: blog.coverImageUrl,
              createdAt: blog.publishedAt ? new Date(blog.publishedAt) : new Date(),
              authorId: blog.authorId,
              authorName: blog.authorName,
              authorAvatar: blog.authorAvatar,
              groupId: blog.groupId ?? undefined,
              commentCount: blog.commentCount,
              tags: blog.hashtags?.map(hashtag => hashtag.tag) ?? [],
            }}
          />
        </div>
      </TimelineCardActions>
    </TimelineCardBase>
  );
}

'use client';

import { Users, MessageSquare } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useSubscribeBlog } from '@/features/blogs/hooks/useSubscribeBlog';
import { getContentTypeGradient } from '../../constants/content-type-config';

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
  href?: string;
  className?: string;
}
import { BlogTimelineCardView } from './BlogTimelineCardView';
export function BlogTimelineCard({ blog, href, className }: BlogTimelineCardProps) {
  const { t } = useTranslation();
  const gradient = getContentTypeGradient('blog');
  const subscription = useSubscribeBlog(blog.id);

  const blogUrl =
    href ??
    (blog.groupId
      ? `/group/${blog.groupId}/blog/${blog.id}`
      : blog.authorId
        ? `/user/${blog.authorId}/blog/${blog.id}`
        : `/blog/${blog.id}`);

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
    <BlogTimelineCardView
      blog={blog}
      className={className}
      t={t}
      gradient={gradient}
      subscription={subscription}
      blogUrl={blogUrl}
      stats={stats}
    />
  );
}

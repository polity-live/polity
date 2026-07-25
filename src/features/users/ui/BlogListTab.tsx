import { FormControlInput } from '@/features/shared/ui/form';
import React, { useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { BlogTimelineCard } from '@/features/timeline/ui/cards/BlogTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { ProfileBloggerRelation } from '../types/user.types';
import { PolityZeroGridView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';

interface BlogListTabProps {
  authorName: string;
  authorAvatar: string;
  userId: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const BlogListTab: React.FC<BlogListTabProps> = ({
  authorName,
  authorAvatar,
  userId,
  searchValue,
  onSearchChange,
}) => {
  const { t } = useTranslation();

  const context = useMemo(() => ({ userId, query: searchValue.trim() }), [searchValue, userId]);

  return (
    <>
      <div className="relative mb-4">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <FormControlInput
          placeholder={t('pages.user.blogs.searchPlaceholder')}
          className="pl-10"
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      <PolityZeroGridView<
        NonNullable<ProfileBloggerRelation['blog']>,
        { created_at: number; id: string },
        typeof context
      >
        context={context}
        historyKey={`user-${userId}-blogs`}
        getPageQuery={useCallback(
          ({ limit, start, dir, settled }) => ({
            query: queries.blogs.pageByUser({ ...context, limit, start, dir }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          }),
          [context]
        )}
        getSingleQuery={useCallback(
          ({ id, settled }) => ({
            query: queries.blogs.byIdWithHashtags({ id }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          }),
          []
        )}
        getRowKey={blog => blog.id}
        toStartRow={blog => ({ created_at: blog.created_at, id: blog.id })}
        getLanes={width => (width >= 1024 ? 3 : width >= 768 ? 2 : 1)}
        estimateSize={360}
        renderRow={(blog, index) => {
          const hashtags = (blog.blog_hashtags ?? [])
            .map(j => j.hashtag)
            .filter((h): h is NonNullable<typeof h> => !!h);
          return (
            <div
              className="civic-load-card-reveal"
              style={{ '--civic-load-index': Math.min(index, 11) } as React.CSSProperties}
            >
              <BlogTimelineCard
                blog={{
                  id: String(blog.id),
                  title: blog.title ?? '',
                  excerpt: blog.description ?? undefined,
                  coverImageUrl: blog.image_url ?? undefined,
                  commentCount: blog.comment_count ?? 0,
                  hashtags,
                  authorName: authorName || t('common.labels.unspecifiedUser'),
                  authorAvatar,
                  authorId: userId,
                  groupId: blog.group_id ?? undefined,
                  publishedAt: blog.date ?? '',
                }}
              />
            </div>
          );
        }}
        renderSkeleton={() => <Skeleton className="h-80 w-full rounded-xl" />}
        renderEmpty={() => (
          <p className="text-muted-foreground py-8 text-center">
            {t('pages.user.blogs.noResults')}
          </p>
        )}
      />
    </>
  );
};

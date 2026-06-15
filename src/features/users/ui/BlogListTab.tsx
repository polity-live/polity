import { FormControlInput } from '@/features/shared/ui/form';
import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import { BlogTimelineCard } from '@/features/timeline/ui/cards/BlogTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { ProfileBloggerRelation } from '../types/user.types';
import { matchesSearchQuery } from '../logic/userWikiSearch';

interface BlogListTabProps {
  bloggerRelations: readonly ProfileBloggerRelation[];
  authorName: string;
  authorAvatar: string;
  userId?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const BlogListTab: React.FC<BlogListTabProps> = ({
  bloggerRelations,
  authorName,
  authorAvatar,
  userId,
  searchValue,
  onSearchChange,
}) => {
  const { t } = useTranslation();

  // Deduplicate by blog id and filter to relations with a blog
  const blogs = useMemo(() => {
    const seen = new Set<string>();
    return bloggerRelations
      .filter((r): r is typeof r & { blog: NonNullable<typeof r.blog> } => !!r.blog)
      .filter(r => {
        if (seen.has(r.blog.id)) return false;
        seen.add(r.blog.id);
        return true;
      });
  }, [bloggerRelations]);

  const filteredBlogs = useMemo(() => {
    return blogs.filter(relation =>
      matchesSearchQuery(
        searchValue,
        relation.blog.title,
        relation.blog.description,
        relation.blog.date
      )
    );
  }, [blogs, searchValue]);

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
      {filteredBlogs.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">{t('pages.user.blogs.noResults')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBlogs.map((relation, index) => {
            const blog = relation.blog;
            const hashtags = (blog.blog_hashtags ?? [])
              .map(j => j.hashtag)
              .filter((h): h is NonNullable<typeof h> => !!h);
            return (
              <div
                key={blog.id}
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
          })}
        </div>
      )}
    </>
  );
};

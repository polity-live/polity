import { FormControlInput } from '@/features/shared/ui/form';
import { BlogTimelineCard } from '@/features/timeline/ui/cards/BlogTimelineCard';
import { StatementTimelineCard } from '@/features/timeline/ui/cards/StatementTimelineCard';
import { Button } from '@/features/shared/ui/ui/button';
import { FilterButton } from '@/features/shared/ui/filter-controls';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { Link } from '@tanstack/react-router';
import { Search, BookOpen, MessageSquareText, Plus, Edit, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { PolityZeroGridView } from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { queries } from '@/zero/queries';

type ContentFilter = 'all' | 'blogs' | 'statements';

interface BlogItem {
  id: string;
  created_at: number;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
  comment_count?: number | null;
  group_id?: string | null;
  user_id?: string | null;
  date?: string | null;
  blog_hashtags?: readonly { hashtag?: { id: string; tag: string } | null }[];
}

interface StatementItem {
  id: string;
  created_at: number;
  text?: string | null;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    handle?: string | null;
    avatar?: string | null;
  } | null;
  upvotes?: number | null;
  downvotes?: number | null;
  comment_count?: number | null;
  image_url?: string | null;
  video_url?: string | null;
  group_id?: string | null;
  statement_hashtags?: readonly { hashtag?: { id: string; tag: string } | null }[];
}

interface BlogsAndStatementsViewProps {
  groupId: string;
  blogs: BlogItem[];
  statements: StatementItem[];
  filter: ContentFilter;
  setFilter: (filter: ContentFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  canManage: boolean;
  canCreateBlog: boolean;
  canCreateStatement: boolean;
  getEditorUrl: (blogId: string) => string;
  onDeleteBlog: (blogId: string, blogTitle: string) => void;
}

function VirtualBlogGrid({
  groupId,
  searchQuery,
  canManage,
  getEditorUrl,
  onDeleteBlog,
  compact,
}: Pick<
  BlogsAndStatementsViewProps,
  'groupId' | 'searchQuery' | 'canManage' | 'getEditorUrl' | 'onDeleteBlog'
> & { compact: boolean }) {
  const context = useMemo(() => ({ groupId, query: searchQuery.trim() }), [groupId, searchQuery]);
  return (
    <PolityZeroGridView<BlogItem, { created_at: number; id: string }, typeof context>
      context={context}
      historyKey={`group-${groupId}-blogs`}
      estimateSize={330}
      getLanes={width => (width >= 640 ? 2 : 1)}
      getRowKey={blog => blog.id}
      toStartRow={blog => ({ created_at: blog.created_at, id: blog.id })}
      getPageQuery={useCallback(
        ({ limit, start, dir, settled }) => ({
          query: queries.blogs.pageByGroup({ ...context, limit, start, dir }) as any,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        }),
        [context]
      )}
      getSingleQuery={useCallback(
        ({ id, settled }) => ({
          query: queries.blogs.byIdWithHashtags({ id }) as any,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        }),
        []
      )}
      renderRow={blog => (
        <div className="relative">
          <BlogTimelineCard
            blog={{
              id: blog.id,
              title: blog.title ?? '',
              excerpt: blog.description ?? undefined,
              coverImageUrl: blog.image_url ?? undefined,
              commentCount: blog.comment_count ?? undefined,
              groupId: blog.group_id,
              authorId: blog.user_id ?? undefined,
              publishedAt: blog.date ?? undefined,
              hashtags: (blog.blog_hashtags ?? [])
                .map(link => link.hashtag)
                .filter((tag): tag is { id: string; tag: string } => Boolean(tag)),
            }}
          />
          {canManage ? (
            <div className="absolute top-2 right-2 flex gap-1">
              <Link to={getEditorUrl(blog.id)}>
                <Button variant="ghost" size="icon" className="bg-background/80 h-7 w-7">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 text-destructive h-7 w-7"
                onClick={() => onDeleteBlog(blog.id, blog.title ?? '')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      )}
      renderSkeleton={() => <Skeleton className="h-72 w-full rounded-xl" />}
      renderEmpty={() => null}
      viewportClassName={compact ? 'h-[36rem] min-h-80 overflow-auto' : undefined}
    />
  );
}

function VirtualStatementGrid({
  groupId,
  searchQuery,
  compact,
}: Pick<BlogsAndStatementsViewProps, 'groupId' | 'searchQuery'> & { compact: boolean }) {
  const now = useMemo(() => Date.now(), [groupId]);
  const context = useMemo(
    () => ({ groupId, query: searchQuery.trim(), now }),
    [groupId, now, searchQuery]
  );
  return (
    <PolityZeroGridView<StatementItem, { created_at: number; id: string }, typeof context>
      context={context}
      historyKey={`group-${groupId}-statements`}
      estimateSize={330}
      getLanes={width => (width >= 640 ? 2 : 1)}
      getRowKey={statement => statement.id}
      toStartRow={statement => ({ created_at: statement.created_at, id: statement.id })}
      getPageQuery={useCallback(
        ({ limit, start, dir, settled }) => ({
          query: queries.statements.pageByGroup({ ...context, limit, start, dir }) as any,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        }),
        [context]
      )}
      getSingleQuery={useCallback(
        ({ id, settled }) => ({
          query: queries.statements.byIdWithDetails({ id }) as any,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        }),
        []
      )}
      renderRow={statement => (
        <StatementTimelineCard
          statement={{
            id: statement.id,
            content: statement.text ?? '',
            authorName: statement.user
              ? [statement.user.first_name, statement.user.last_name].filter(Boolean).join(' ') ||
                statement.user.handle ||
                ''
              : '',
            authorAvatar: statement.user?.avatar ?? undefined,
            supportCount: statement.upvotes ?? undefined,
            opposeCount: statement.downvotes ?? undefined,
            commentCount: statement.comment_count ?? undefined,
            imageUrl: statement.image_url ?? undefined,
            videoUrl: statement.video_url ?? undefined,
            groupId: statement.group_id ?? undefined,
            hashtags: (statement.statement_hashtags ?? [])
              .map(link => link.hashtag)
              .filter((tag): tag is { id: string; tag: string } => Boolean(tag)),
          }}
        />
      )}
      renderSkeleton={() => <Skeleton className="h-72 w-full rounded-xl" />}
      renderEmpty={() => null}
      viewportClassName={compact ? 'h-[36rem] min-h-80 overflow-auto' : undefined}
    />
  );
}

export function BlogsAndStatementsView({
  groupId,
  blogs,
  statements,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  canManage,
  canCreateBlog,
  canCreateStatement,
  getEditorUrl,
  onDeleteBlog,
}: BlogsAndStatementsViewProps) {
  const { t } = useTranslation();

  const filters: { value: ContentFilter; label: string }[] = [
    { value: 'all', label: translateText('generated.inline.0045_all_6a720856') },
    { value: 'blogs', label: translateText('generated.inline.0030_blogs_5ef44397') },
    { value: 'statements', label: t('features.statements.title') },
  ];

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t('navigation.secondary.group.blogsAndStatements')}</h1>

      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <FormControlInput
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={translateText('generated.inline.0299_search_6d7a30a9')}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1">
          {filters.map((f: any) => (
            <FilterButton
              key={f.value}
              active={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </FilterButton>
          ))}
        </div>
        {canCreateBlog || canCreateStatement ? (
          <div className="flex shrink-0 gap-2">
            {canCreateBlog ? (
              <Link to="/create/blog-entry" search={{ groupId }}>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  {translateText('generated.inline.0297_blog_0b9d2b23')}
                </Button>
              </Link>
            ) : null}
            {canCreateStatement ? (
              <Link to="/create/statement" search={{ groupId }}>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-4 w-4" />
                  {translateText('generated.inline.0298_statement_a72ca256')}
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Blog section */}
      {filter !== 'statements' && blogs.length > 0 && (
        <div className="space-y-3">
          {filter === 'all' && (
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="h-5 w-5" />
              {translateText('generated.inline.0300_blogs_5ef44397')}
            </h2>
          )}
          <VirtualBlogGrid
            groupId={groupId}
            searchQuery={searchQuery}
            canManage={canManage}
            getEditorUrl={getEditorUrl}
            onDeleteBlog={onDeleteBlog}
            compact={filter === 'all'}
          />
        </div>
      )}

      {/* Statement section */}
      {filter !== 'blogs' && statements.length > 0 && (
        <div className="space-y-3">
          {filter === 'all' && (
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MessageSquareText className="h-5 w-5" /> {t('features.statements.title')}
            </h2>
          )}
          <VirtualStatementGrid
            groupId={groupId}
            searchQuery={searchQuery}
            compact={filter === 'all'}
          />
        </div>
      )}

      {/* Empty state */}
      {filter !== 'statements' &&
        blogs.length === 0 &&
        filter !== 'blogs' &&
        statements.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              {translateText('generated.inline.0301_no_content_yet_f4efebd0')}
            </p>
          </div>
        )}
    </div>
  );
}

import React, { useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ScrollableTabsList } from '@/features/shared/ui/navigation';
import { EntitySearchBar } from '@/features/shared/ui/typeahead';
import { BlogListTab } from './BlogListTab';
import { GroupsListTab } from './GroupListTab';
import { AmendmentListTab } from './AmendmentListTab';
import { StatementListTab } from './StatementListTab';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { StatementStoryCarousel } from '@/features/statements/ui/StatementStoryCarousel';
import type { UserProfile, TabSearchState } from '../types/user.types';
import { PolityZeroGridView } from '@/features/shared/virtualization';
import { SearchResultCard } from '@/features/search/ui/SearchResultCard';
import type { SearchDocument } from '@/features/search/types/search-document.types';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { queries } from '@/zero/queries';

interface UserWikiContentTabsProps {
  user: UserProfile;
  authorName: string;
  authorAvatar: string;
  searchTerms: TabSearchState;
  handleSearchChange: (tab: keyof TabSearchState, value: string) => void;
}

export const UserWikiContentTabs: React.FC<UserWikiContentTabsProps> = ({
  user,
  authorName,
  authorAvatar,
  searchTerms,
  handleSearchChange,
}) => {
  const { t } = useTranslation();
  const resolvedAuthorName = authorName || t('common.labels.unspecifiedUser');

  const allContext = useMemo(
    () => ({
      ownerUserId: user.id,
      query: searchTerms.all,
      types: ['amendment', 'blog', 'group', 'statement'],
    }),
    [searchTerms.all, user.id]
  );

  const renderAmendmentsTab = () => (
    <AmendmentListTab
      collaborations={user.amendment_collaborations ?? []}
      userId={user.id}
      searchValue={searchTerms.amendments}
      onSearchChange={(value: string) => handleSearchChange('amendments', value)}
    />
  );

  const renderBlogsTab = () => (
    <BlogListTab
      bloggerRelations={user.blogger_relations ?? []}
      authorName={authorName}
      authorAvatar={authorAvatar}
      userId={user.id}
      searchValue={searchTerms.blogs}
      onSearchChange={(value: string) => handleSearchChange('blogs', value)}
    />
  );

  const renderGroupsTab = () => (
    <GroupsListTab
      memberships={user.group_memberships ?? []}
      userId={user.id}
      searchValue={searchTerms.groups}
      onSearchChange={(value: string) => handleSearchChange('groups', value)}
    />
  );

  const renderStatementsTab = () => (
    <StatementListTab
      statements={user.statements ?? []}
      authorName={resolvedAuthorName}
      authorTitle={user.bio ?? undefined}
      authorAvatar={authorAvatar || undefined}
      userId={user.id}
      searchValue={searchTerms.statements}
      onSearchChange={(value: string) => handleSearchChange('statements', value)}
    />
  );

  return (
    <div className="mt-8">
      <StatementStoryCarousel userId={user.id} className="mb-6" />

      <Tabs defaultValue="all">
        <ScrollableTabsList>
          <TabsTrigger value="all">{t('pages.user.all.title')}</TabsTrigger>
          <TabsTrigger value="amendments">{t('pages.user.amendments.title')}</TabsTrigger>
          <TabsTrigger value="blogs">{t('pages.user.blogs.title')}</TabsTrigger>
          <TabsTrigger value="groups">{t('pages.user.groups.title')}</TabsTrigger>
          <TabsTrigger value="statements">{t('pages.user.statements.title')}</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="all" className="mt-4 space-y-4">
          <EntitySearchBar
            searchQuery={searchTerms.all}
            onSearchQueryChange={value => handleSearchChange('all', value)}
            placeholder={t('pages.user.all.searchPlaceholder')}
          />

          <PolityZeroGridView<SearchDocument, { created_at: number; id: string }, typeof allContext>
            context={allContext}
            historyKey={`user-${user.id}-all-content`}
            getPageQuery={useCallback(
              ({ limit, start, dir, settled }) => ({
                query: queries.search.searchDocumentPage({
                  query: allContext.query,
                  types: allContext.types,
                  topics: [],
                  createdAfter: null,
                  engagement: 'all',
                  sort: 'recent',
                  snapshotAt: null,
                  bounds: null,
                  ownerUserId: allContext.ownerUserId,
                  limit,
                  start,
                  dir,
                }) as never,
                options: { ttl: settled ? ('5m' as const) : ('none' as const) },
              }),
              [allContext]
            )}
            getSingleQuery={useCallback(
              ({ id, settled }) => ({
                query: queries.search.searchDocumentById({
                  id,
                  ownerUserId: user.id,
                }) as never,
                options: { ttl: settled ? ('5m' as const) : ('none' as const) },
              }),
              [user.id]
            )}
            getRowKey={document => document.id}
            toStartRow={document => ({ created_at: document.created_at, id: document.id })}
            getLanes={width => (width >= 1280 ? 3 : width >= 720 ? 2 : 1)}
            estimateSize={360}
            renderRow={(document, index) => (
              <div
                className="civic-load-card-reveal"
                style={{ '--civic-load-index': Math.min(index, 11) } as React.CSSProperties}
              >
                <SearchResultCard document={document} />
              </div>
            )}
            renderSkeleton={() => <Skeleton className="h-[360px] w-full rounded-xl" />}
            renderEmpty={() => (
              <p className="text-muted-foreground py-8 text-center">
                {t('pages.user.all.noResults', { defaultValue: 'No content found.' })}
              </p>
            )}
          />
        </TabsContent>

        <TabsContent value="amendments" className="mt-4">
          {renderAmendmentsTab()}
        </TabsContent>

        <TabsContent value="blogs" className="mt-4">
          {renderBlogsTab()}
        </TabsContent>

        <TabsContent value="groups" className="mt-4">
          {renderGroupsTab()}
        </TabsContent>

        <TabsContent value="statements" className="mt-4">
          {renderStatementsTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

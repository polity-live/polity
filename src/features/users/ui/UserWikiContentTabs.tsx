import React, { useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ScrollableTabsList } from '@/features/shared/ui/navigation';
import { EntitySearchBar } from '@/features/shared/ui/typeahead';
import { BlogListTab } from './BlogListTab';
import { GroupsListTab } from './GroupListTab';
import { AmendmentListTab } from './AmendmentListTab';
import { StatementListTab } from './StatementListTab';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { MasonryGrid } from '@/features/timeline/ui/MasonryGrid';
import { DynamicTimelineCard } from '@/features/timeline/ui/LazyCardComponents';
import { buildTimelineCardProps } from '@/features/search/logic/buildTimelineCardProps';
import { StatementStoryCarousel } from '@/features/statements/ui/StatementStoryCarousel';
import type { UserProfile, TabSearchState } from '../types/user.types';
import {
  buildUserWikiContentItems,
  type UserWikiContentItem,
} from '../logic/buildUserWikiContentItems';

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

  const allItems = useMemo(
    () =>
      buildUserWikiContentItems({
        user,
        authorName: resolvedAuthorName,
        authorAvatar,
      }),
    [authorAvatar, resolvedAuthorName, user]
  );

  const filteredAllItems = useMemo(() => {
    const query = searchTerms.all.trim().toLowerCase();
    if (!query) {
      return allItems;
    }

    return allItems.filter(item => item.searchText.includes(query));
  }, [allItems, searchTerms.all]);

  const renderMixedTimelineCard = useCallback((item: UserWikiContentItem) => {
    const { cardType, cardProps } = buildTimelineCardProps(item);
    if (!cardType || !cardProps) {
      return null;
    }

    return <DynamicTimelineCard cardType={cardType} cardProps={cardProps} />;
  }, []);

  const renderAmendmentsTab = () => (
    <AmendmentListTab
      collaborations={user.amendment_collaborations ?? []}
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

          <MasonryGrid
            items={filteredAllItems}
            renderItem={renderMixedTimelineCard}
            keyExtractor={item => `${item.type}-${item.id}`}
            itemMotion="reveal"
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

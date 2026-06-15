import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { countAcceptedMemberships } from '@/features/groups/logic/groupWikiHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { ScrollableTabsList } from '@/features/shared/ui/navigation';
import { FormControlInput } from '@/features/shared/ui/form';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';

type RelatedGroupRelation = 'parent' | 'child';
type RelatedGroupsTab = 'all' | 'childGroups' | 'parentGroups';

interface RelatedGroupRow {
  group?: any;
}

interface RelatedGroupItem {
  group: any;
  relations: Set<RelatedGroupRelation>;
}

interface RelatedGroupsTabsProps {
  parentGroups: RelatedGroupRow[];
  childGroups: RelatedGroupRow[];
}

function toPlainDescription(value: unknown) {
  return richTextToPlainText(value) || undefined;
}

function getRelatedGroupSearchText(item: RelatedGroupItem) {
  return [
    item.group?.name,
    toPlainDescription(item.group?.description),
    item.relations.has('parent') ? 'parent' : '',
    item.relations.has('child') ? 'child' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function buildRelatedItems(
  parentGroups: RelatedGroupRow[],
  childGroups: RelatedGroupRow[]
): RelatedGroupItem[] {
  const byId = new Map<string, RelatedGroupItem>();

  const addGroup = (row: RelatedGroupRow, relation: RelatedGroupRelation) => {
    const group = row.group;
    const id = group?.id ? String(group.id) : null;

    if (!id) {
      return;
    }

    const existing = byId.get(id);
    if (existing) {
      existing.relations.add(relation);
      return;
    }

    byId.set(id, {
      group,
      relations: new Set([relation]),
    });
  };

  parentGroups.forEach(row => addGroup(row, 'parent'));
  childGroups.forEach(row => addGroup(row, 'child'));

  return [...byId.values()].sort((left, right) =>
    (left.group?.name || '').localeCompare(right.group?.name || '', undefined, {
      sensitivity: 'base',
    })
  );
}

export function RelatedGroupsTabs({ parentGroups, childGroups }: RelatedGroupsTabsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<RelatedGroupsTab>('all');
  const [searchValue, setSearchValue] = useState('');

  const allItems = useMemo(
    () => buildRelatedItems(parentGroups, childGroups),
    [childGroups, parentGroups]
  );
  const visibleItemsByTab = useMemo<Record<RelatedGroupsTab, RelatedGroupItem[]>>(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const matchesSearch = (item: RelatedGroupItem) =>
      !normalizedSearch || getRelatedGroupSearchText(item).includes(normalizedSearch);

    return {
      all: allItems.filter(matchesSearch),
      childGroups: allItems.filter(item => item.relations.has('child') && matchesSearch(item)),
      parentGroups: allItems.filter(item => item.relations.has('parent') && matchesSearch(item)),
    };
  }, [allItems, searchValue]);

  if (allItems.length === 0) {
    return null;
  }

  const renderGroupGrid = (items: RelatedGroupItem[], tab: RelatedGroupsTab) => {
    if (items.length === 0) {
      return (
        <p className="text-muted-foreground py-8 text-center">
          {t('pages.group.relatedGroups.noResults', 'No related groups match your search.')}
        </p>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => {
          const group = item.group;

          return (
            <div
              key={`${tab}-${group.id}`}
              className="civic-load-card-reveal"
              style={
                {
                  '--civic-load-index': Math.min(index, 11),
                } as CSSProperties
              }
            >
              <GroupTimelineCard
                group={{
                  id: String(group.id),
                  name: group.name || t('common.unspecified'),
                  description: toPlainDescription(group.description),
                  memberCount: group.member_count ?? countAcceptedMemberships(group.memberships),
                  amendmentCount: group.amendments?.length || 0,
                  eventCount: group.events?.length || 0,
                }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section className="mb-8 space-y-4" data-slot="related-groups-tabs">
      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as RelatedGroupsTab)}>
        <ScrollableTabsList>
          <TabsTrigger value="all">{t('common.all', 'All')}</TabsTrigger>
          <TabsTrigger value="childGroups">{t('pages.group.childGroups.title')}</TabsTrigger>
          <TabsTrigger value="parentGroups">{t('pages.group.parentGroups.title')}</TabsTrigger>
        </ScrollableTabsList>

        <div className="relative mt-4">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <FormControlInput
            placeholder={t('pages.group.relatedGroups.searchPlaceholder', 'Search related groups')}
            className="pl-10"
            value={searchValue}
            onChange={event => setSearchValue(event.target.value)}
          />
        </div>

        <TabsContent value="all" className="mt-4">
          {renderGroupGrid(visibleItemsByTab.all, 'all')}
        </TabsContent>
        <TabsContent value="childGroups" className="mt-4">
          {renderGroupGrid(visibleItemsByTab.childGroups, 'childGroups')}
        </TabsContent>
        <TabsContent value="parentGroups" className="mt-4">
          {renderGroupGrid(visibleItemsByTab.parentGroups, 'parentGroups')}
        </TabsContent>
      </Tabs>
    </section>
  );
}

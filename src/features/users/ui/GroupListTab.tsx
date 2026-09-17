import { CollectionToolbar } from '@/features/shared/ui/collections/CollectionToolbar';
import { CollectionCard } from '@/features/shared/ui/collections/CollectionCard';
import { useCollectionView } from '@/features/shared/ui/collections/useCollectionView';
import { FormControlInput } from '@/features/shared/ui/form';
import React, { useCallback, useMemo } from 'react';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { Search } from 'lucide-react';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { PolityZeroGridView } from '@/features/shared/virtualization';

import type { ProfileGroupMembership } from '../types/user.types';
import { queries } from '@/zero/queries';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';

interface GroupsListTabProps {
  userId: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const GroupsListTab: React.FC<GroupsListTabProps> = ({
  userId,
  searchValue,
  onSearchChange,
}) => {
  const { t } = useTranslation();
  const { view, setView } = useCollectionView('profile.groups');

  const context = useMemo(() => ({ userId, query: searchValue.trim() }), [searchValue, userId]);

  return (
    <>
      <CollectionToolbar
        view={view}
        onViewChange={setView}
        search={
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <FormControlInput
              placeholder={t('pages.user.groups.searchPlaceholder')}
              className="pl-10"
              value={searchValue}
              onChange={e => onSearchChange(e.target.value)}
            />
          </div>
        }
      />
      <PolityZeroGridView<
        ProfileGroupMembership,
        { created_at: number; id: string },
        typeof context
      >
        layoutKey={view}
        context={context}
        historyKey={`user-${userId}-groups`}
        getPageQuery={useCallback(
          ({ limit, start, dir, settled }) => ({
            query: queries.groups.membershipPageByUser({ ...context, limit, start, dir }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          }),
          [context]
        )}
        getSingleQuery={useCallback(
          ({ id, settled }) => ({
            query: queries.groups.membershipById({ id }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          }),
          []
        )}
        getRowKey={membership => membership.id}
        toStartRow={membership => ({ created_at: membership.created_at, id: membership.id })}
        getLanes={width => (view === 'compact' ? 1 : width >= 1024 ? 3 : width >= 768 ? 2 : 1)}
        estimateSize={view === 'compact' ? 76 : 360}
        renderRow={membership => {
          const group = membership.group;
          if (!group) return null;
          return (
            <CollectionCard
              compact={view === 'compact'}
              model={{
                type: 'group',
                title: group.name ?? '',
                summary: richTextToPlainText(group.description),
                href: `/group/${group.id}`,
              }}
            >
              <GroupTimelineCard
                group={{
                  id: String(group.id),
                  name: group.name ?? '',
                  description: richTextToPlainText(group.description) || undefined,
                  memberCount: group.member_count ?? 0,
                  eventCount: group.event_count ?? group.events?.length,
                  amendmentCount: group.amendment_count ?? group.amendments?.length,
                }}
              />
            </CollectionCard>
          );
        }}
        renderSkeleton={() => <Skeleton className="h-80 w-full rounded-xl" />}
        renderEmpty={() => (
          <p className="text-muted-foreground py-8 text-center">
            {t('pages.user.groups.noResults')}
          </p>
        )}
      />
    </>
  );
};

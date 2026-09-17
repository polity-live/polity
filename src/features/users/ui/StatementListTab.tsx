import { CollectionToolbar } from '@/features/shared/ui/collections/CollectionToolbar';
import { CollectionCard } from '@/features/shared/ui/collections/CollectionCard';
import { useCollectionView } from '@/features/shared/ui/collections/useCollectionView';
import { FormControlInput } from '@/features/shared/ui/form';
import React, { useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { StatementTimelineCard } from '@/features/timeline/ui/cards/StatementTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { ProfileStatement } from '../types/user.types';
import { PolityZeroGridView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';

interface StatementListTabProps {
  authorName: string;
  authorTitle?: string;
  authorAvatar?: string;
  userId: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const StatementListTab: React.FC<StatementListTabProps> = ({
  authorName,
  authorTitle,
  authorAvatar,
  userId,
  searchValue,
  onSearchChange,
}) => {
  const { t } = useTranslation();
  const { view, setView } = useCollectionView('profile.statements');

  const now = useMemo(() => Date.now(), [userId]);
  const context = useMemo(
    () => ({ userId, query: searchValue.trim(), now }),
    [now, searchValue, userId]
  );

  return (
    <>
      <CollectionToolbar
        view={view}
        onViewChange={setView}
        search={
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <FormControlInput
              placeholder={t('pages.user.statements.searchPlaceholder')}
              className="pl-10"
              value={searchValue}
              onChange={event => onSearchChange(event.target.value)}
            />
          </div>
        }
      />
      <PolityZeroGridView<ProfileStatement, { created_at: number; id: string }, typeof context>
        layoutKey={view}
        context={context}
        historyKey={`user-${userId}-statements`}
        getPageQuery={useCallback(
          ({ limit, start, dir, settled }) => ({
            query: queries.statements.pageByUser({ ...context, limit, start, dir }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          }),
          [context]
        )}
        getSingleQuery={useCallback(
          ({ id, settled }) => ({
            query: queries.statements.byIdWithDetails({ id, now }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          }),
          [now]
        )}
        getRowKey={statement => statement.id}
        toStartRow={statement => ({ created_at: statement.created_at, id: statement.id })}
        getLanes={width => (view === 'compact' ? 1 : width >= 1024 ? 3 : width >= 768 ? 2 : 1)}
        estimateSize={view === 'compact' ? 76 : 400}
        renderRow={statement => {
          const supportVotes = statement.support_votes ?? [];
          const survey = statement.surveys?.[0];

          return (
            <CollectionCard
              compact={view === 'compact'}
              model={{
                type: 'statement',
                title: statement.title ?? authorName,
                summary: statement.text ?? undefined,
                href: `/statement/${statement.id}`,
              }}
            >
              <StatementTimelineCard
                statement={{
                  id: String(statement.id),
                  title: statement.title ?? undefined,
                  content: statement.text ?? '',
                  authorName,
                  authorTitle,
                  authorAvatar,
                  imageUrl: statement.image_url ?? undefined,
                  videoUrl: statement.video_url ?? undefined,
                  groupName: statement.group?.name ?? undefined,
                  groupAvatar: statement.group?.image_url ?? undefined,
                  groupId: statement.group_id ?? undefined,
                  supportCount: supportVotes.filter(vote => vote.vote === 1).length,
                  opposeCount: supportVotes.filter(vote => vote.vote === -1).length,
                  commentCount: statement.comment_count ?? 0,
                  surveyQuestion: survey?.question ?? undefined,
                  surveyOptions: survey?.options?.map(option => ({
                    label: option.label,
                    voteCount: option.votes?.length ?? 0,
                  })),
                  hashtags: (statement.statement_hashtags ?? [])
                    .map(junction => ({
                      id: junction.hashtag?.id ?? junction.id,
                      tag: junction.hashtag?.tag ?? '',
                    }))
                    .filter(hashtag => hashtag.tag),
                }}
              />
            </CollectionCard>
          );
        }}
        renderSkeleton={() => <Skeleton className="h-96 w-full rounded-xl" />}
        renderEmpty={() => (
          <p className="text-muted-foreground py-8 text-center">
            {t('pages.user.statements.noResults')}
          </p>
        )}
      />
    </>
  );
};

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
  statements: readonly ProfileStatement[];
  authorName: string;
  authorTitle?: string;
  authorAvatar?: string;
  userId: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const StatementListTab: React.FC<StatementListTabProps> = ({
  statements: _statements,
  authorName,
  authorTitle,
  authorAvatar,
  userId,
  searchValue,
  onSearchChange,
}) => {
  void _statements;
  const { t } = useTranslation();

  const now = useMemo(() => Date.now(), [userId]);
  const context = useMemo(
    () => ({ userId, query: searchValue.trim(), now }),
    [now, searchValue, userId]
  );

  return (
    <>
      <div className="relative mb-4">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <FormControlInput
          placeholder={t('pages.user.statements.searchPlaceholder')}
          className="pl-10"
          value={searchValue}
          onChange={event => onSearchChange(event.target.value)}
        />
      </div>
      <PolityZeroGridView<ProfileStatement, { created_at: number; id: string }, typeof context>
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
            query: queries.statements.byIdWithDetails({ id }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          }),
          []
        )}
        getRowKey={statement => statement.id}
        toStartRow={statement => ({ created_at: statement.created_at, id: statement.id })}
        getLanes={width => (width >= 1024 ? 3 : width >= 768 ? 2 : 1)}
        estimateSize={400}
        renderRow={(statement, index) => {
          const supportVotes = statement.support_votes ?? [];
          const survey = statement.surveys?.[0];

          return (
            <div
              className="civic-load-card-reveal"
              style={{ '--civic-load-index': Math.min(index, 11) } as React.CSSProperties}
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
            </div>
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

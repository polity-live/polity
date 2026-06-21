import { FormControlInput } from '@/features/shared/ui/form';
import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import { StatementTimelineCard } from '@/features/timeline/ui/cards/StatementTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { ProfileStatement } from '../types/user.types';
import { matchesSearchQuery } from '../logic/userWikiSearch';

interface StatementListTabProps {
  statements: readonly ProfileStatement[];
  authorName: string;
  authorTitle?: string;
  authorAvatar?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const StatementListTab: React.FC<StatementListTabProps> = ({
  statements,
  authorName,
  authorTitle,
  authorAvatar,
  searchValue,
  onSearchChange,
}) => {
  const { t } = useTranslation();

  const filteredStatements = useMemo(() => {
    return statements.filter(statement => {
      const tags = (statement.statement_hashtags ?? []).map(junction => junction.hashtag?.tag);
      return matchesSearchQuery(
        searchValue,
        statement.title,
        statement.text,
        statement.group?.name,
        tags
      );
    });
  }, [searchValue, statements]);

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
      {filteredStatements.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {t('pages.user.statements.noResults')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStatements.map((statement, index) => {
            const supportVotes = statement.support_votes ?? [];
            const survey = statement.surveys?.[0];

            return (
              <div
                key={statement.id}
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
          })}
        </div>
      )}
    </>
  );
};

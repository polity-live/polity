import { FormControlInput } from '@/features/shared/ui/form';
import React, { useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { AmendmentTimelineCard } from '@/features/timeline/ui/cards/AmendmentTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { normalizeEditingMode } from '@/zero/amendments/editing-mode-policy';
import type { ProfileAmendmentCollaboration } from '../types/user.types';
import {
  getOrderedBranches,
  mapAmendmentBranchStatusChips,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import { PolityZeroGridView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';

interface AmendmentListTabProps {
  userId: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const AmendmentListTab: React.FC<AmendmentListTabProps> = ({
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
          placeholder={t('pages.user.amendments.searchPlaceholder')}
          className="pl-10"
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      <PolityZeroGridView<
        ProfileAmendmentCollaboration,
        { created_at: number; id: string },
        typeof context
      >
        context={context}
        historyKey={`user-${userId}-amendments`}
        getPageQuery={useCallback(
          ({ limit, start, dir, settled }) => ({
            query: queries.amendments.collaborationPageByUser({
              ...context,
              limit,
              start,
              dir,
            }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          }),
          [context]
        )}
        getSingleQuery={useCallback(
          ({ id, settled }) => ({
            query: queries.amendments.collaboratorById({ id }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          }),
          []
        )}
        getRowKey={collaboration => collaboration.id}
        toStartRow={collaboration => ({
          created_at: collaboration.created_at,
          id: collaboration.id,
        })}
        getLanes={width => (width >= 768 ? 2 : 1)}
        estimateSize={380}
        renderRow={(collab, index) => {
          const a = collab.amendment;
          if (!a) return null;
          const hashtagTags = (a.amendment_hashtags ?? [])
            .map(j => j.hashtag?.tag)
            .filter((tag): tag is string => !!tag);
          const rawTags = a.tags;
          const tags =
            hashtagTags.length > 0
              ? hashtagTags
              : Array.isArray(rawTags)
                ? rawTags.filter((tag): tag is string => typeof tag === 'string')
                : undefined;
          const branches = a.current_process_run?.branches ?? [];
          const firstBranch = getOrderedBranches(branches)[0] ?? null;
          const branchStatuses = mapAmendmentBranchStatusChips(branches);

          return (
            <div
              className="civic-load-card-reveal"
              style={{ '--civic-load-index': Math.min(index, 11) } as React.CSSProperties}
            >
              <AmendmentTimelineCard
                amendment={{
                  id: String(a.id),
                  title: a.title ?? '',
                  subtitle: a.reason ?? undefined,
                  description: a.reason ?? undefined,
                  status: normalizeEditingMode(firstBranch?.editing_mode),
                  groupName: a.group?.name ?? undefined,
                  groupId: a.group?.id,
                  hashtags: tags?.map((tag, index) => ({
                    id: `${a.id}-${index}-${tag}`,
                    tag,
                  })),
                  branchStatuses,
                }}
              />
            </div>
          );
        }}
        renderSkeleton={() => <Skeleton className="h-96 w-full rounded-xl" />}
        renderEmpty={() => (
          <p className="text-muted-foreground py-8 text-center">
            {t('pages.user.amendments.noResults')}
          </p>
        )}
      />
    </>
  );
};

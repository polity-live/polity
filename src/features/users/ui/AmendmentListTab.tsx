import { FormControlInput } from '@/features/shared/ui/form';
import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import { AmendmentTimelineCard } from '@/features/timeline/ui/cards/AmendmentTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { normalizeEditingMode } from '@/zero/amendments/editing-mode-policy';
import type { ProfileAmendmentCollaboration } from '../types/user.types';
import { matchesSearchQuery } from '../logic/userWikiSearch';
import {
  getOrderedBranches,
  mapAmendmentBranchStatusChips,
} from '@/features/amendments/logic/amendmentBranchDisplay';

interface AmendmentListTabProps {
  collaborations: readonly ProfileAmendmentCollaboration[];
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const AmendmentListTab: React.FC<AmendmentListTabProps> = ({
  collaborations,
  searchValue,
  onSearchChange,
}) => {
  const { t } = useTranslation();

  const withAmendment = useMemo(
    () =>
      collaborations.filter(
        (
          collaboration
        ): collaboration is ProfileAmendmentCollaboration & {
          amendment: NonNullable<ProfileAmendmentCollaboration['amendment']>;
        } => Boolean(collaboration.amendment)
      ),
    [collaborations]
  );

  const filtered = useMemo(() => {
    return withAmendment.filter(collab => {
      const a = collab.amendment;
      const hashtagTags = (a.amendment_hashtags ?? [])
        .map(junction => junction.hashtag?.tag)
        .filter((tag): tag is string => typeof tag === 'string');
      const firstBranch = getOrderedBranches(a.current_process_run?.branches ?? [])[0] ?? null;

      return matchesSearchQuery(
        searchValue,
        a.title,
        firstBranch?.editing_mode,
        a.reason,
        a.code,
        a.created_at,
        hashtagTags,
        Array.isArray(a.tags) ? a.tags : undefined
      );
    });
  }, [withAmendment, searchValue]);

  // Deduplicate by amendment id
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return filtered.filter(c => {
      const id = c.amendment.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [filtered]);

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
      {unique.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {t('pages.user.amendments.noResults')}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {unique.map((collab, index) => {
            const a = collab.amendment;
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
                key={a.id}
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
          })}
        </div>
      )}
    </>
  );
};

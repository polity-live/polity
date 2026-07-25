import { UserMinus } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';

interface SignedUpRosterItem {
  userId?: string | null;
}

export interface WikiRosterSummary {
  totalCount: number;
  signedUpCount: number;
  nonSignedUpCount: number;
}

export interface WikiRosterSummaryCardProps {
  totalCount: number;
  items: readonly SignedUpRosterItem[];
  signedUpCount?: number;
  className?: string;
}

function normalizeRosterCount(count: number) {
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

export function getDistinctSignedUpRosterCount(items: readonly SignedUpRosterItem[]) {
  const userIds = new Set<string>();

  items.forEach(item => {
    const userId = item.userId?.trim();
    if (userId) {
      userIds.add(userId);
    }
  });

  return userIds.size;
}

export function buildWikiRosterSummary({
  totalCount,
  items,
  signedUpCount,
}: WikiRosterSummaryCardProps): WikiRosterSummary {
  const normalizedTotalCount = normalizeRosterCount(totalCount);
  const normalizedSignedUpCount =
    signedUpCount == null
      ? getDistinctSignedUpRosterCount(items)
      : Math.min(normalizedTotalCount, normalizeRosterCount(signedUpCount));

  return {
    totalCount: normalizedTotalCount,
    signedUpCount: normalizedSignedUpCount,
    nonSignedUpCount: Math.max(0, normalizedTotalCount - normalizedSignedUpCount),
  };
}

export function WikiRosterSummaryCard({
  totalCount,
  items,
  signedUpCount,
  className,
}: WikiRosterSummaryCardProps) {
  const summary = buildWikiRosterSummary({ totalCount, items, signedUpCount });
  const nonSignedUpLabel = translateText(
    'features.wiki.rosterSummary.nonSignedUp',
    'Non signed-up users'
  );

  return (
    <Card
      surface="infoSoft"
      className={cn('h-full overflow-hidden', className)}
      data-slot="wiki-roster-summary-card"
    >
      <CardContent className="flex h-full min-h-32 flex-col justify-between gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-5 font-medium">{nonSignedUpLabel}</p>
          <span className="bg-background/70 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--badge-info-border)]">
            <UserMinus className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="text-4xl leading-none font-semibold tabular-nums">
          {summary.nonSignedUpCount}
        </p>
      </CardContent>
    </Card>
  );
}

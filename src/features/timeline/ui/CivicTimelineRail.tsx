'use client';

import { useMemo, type CSSProperties } from 'react';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { ArrowUpRight, Clock3, MapPin, Radio, Sparkles } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { CONTENT_TYPE_CONFIG } from '../constants/content-type-config';
import {
  formatDistanceKm,
  type CivicTimelineItem,
  type CivicTimelineReason,
  type CivicTimelineSection,
} from '../logic/civicTimeline';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { PolityZeroListView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { mapTimelineEvent } from '../hooks/useCivicTimeline';

interface CivicTimelineRailProps {
  sections: CivicTimelineSection[];
  activeItemId?: string | null;
  isLoading?: boolean;
  onActiveItemChange?: (itemId: string | null) => void;
  onItemSelect?: (item: CivicTimelineItem) => void;
  queryContext?: {
    entityIds?: string[];
    contentTypes: string[];
  };
}

const REASON_LABELS: Record<CivicTimelineReason, string> = {
  subscribed: 'features.timeline.around.reasons.subscribed',
  member_context: 'features.timeline.around.reasons.memberContext',
  near_you: 'features.timeline.around.reasons.nearYou',
  interest_match: 'features.timeline.around.reasons.interestMatch',
  active_now: 'features.timeline.around.reasons.activeNow',
  popular_nearby: 'features.timeline.around.reasons.popularNearby',
  public_discovery: 'features.timeline.around.reasons.publicDiscovery',
  urgent_decision: 'features.timeline.around.reasons.urgentDecision',
};

const REASON_FALLBACKS: Record<CivicTimelineReason, string> = {
  subscribed: 'Following',
  member_context: 'Connected',
  near_you: 'Near you',
  interest_match: 'Because of your interests',
  active_now: 'Active now',
  popular_nearby: 'Popular nearby',
  public_discovery: 'Discover',
  urgent_decision: 'Urgent',
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function getItemTime(item: CivicTimelineItem) {
  return item.startDate ?? item.timestamp;
}

function getTypeIcon(item: CivicTimelineItem) {
  return CONTENT_TYPE_CONFIG[item.type]?.icon ?? Radio;
}

function getReasonLabel(
  item: CivicTimelineItem,
  t: (
    key: string,
    paramsOrFallback?: string | Record<string, string | number | null | undefined>,
    fallback?: string
  ) => string
) {
  const matchedTag = item.reason === 'interest_match' ? item.reasonTags?.[0] : undefined;

  if (matchedTag) {
    return t('features.timeline.around.reasons.interestMatchTag', {
      tag: matchedTag,
      defaultValue: `Because of #${matchedTag}`,
    });
  }

  return t(REASON_LABELS[item.reason], {
    defaultValue: REASON_FALLBACKS[item.reason],
  });
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function TimelineArticle({
  item,
  revealIndex,
  activeItemId,
  onActiveItemChange,
  onItemSelect,
}: {
  item: CivicTimelineItem;
  revealIndex: number;
  activeItemId?: string | null;
  onActiveItemChange?: (itemId: string | null) => void;
  onItemSelect?: (item: CivicTimelineItem) => void;
}) {
  const { t } = useTranslation();
  const Icon = getTypeIcon(item);
  const isActive = activeItemId === item.id;
  const reasonLabel = getReasonLabel(item, t);
  const distanceLabel = formatDistanceKm(item.distanceKm);

  return (
    <article
      data-timeline-item-id={item.id}
      className={cn(
        'bg-background civic-load-card-reveal relative rounded-lg border p-4 shadow-sm transition-colors',
        isActive && 'border-primary bg-primary/5'
      )}
      style={{ '--civic-load-index': Math.min(revealIndex, 11) } as CSSProperties}
      onMouseEnter={() => onActiveItemChange?.(item.id)}
      onMouseLeave={() => onActiveItemChange?.(null)}
      onFocus={() => onActiveItemChange?.(item.id)}
      onClick={() => onActiveItemChange?.(item.id)}
    >
      <span
        className={cn(
          'border-background absolute top-6 -left-[18px] h-2.5 w-2.5 rounded-full border-2',
          item.reason === 'urgent_decision'
            ? featureThemeClassName('timelineCivicTimelineRailDangerBackground')
            : item.isDiscover
              ? featureThemeClassName('timelineCivicTimelineRailInfoBackground')
              : featureThemeClassName('timelineCivicTimelineRailSuccessBackground')
        )}
      />
      <div
        data-slot="timeline-item-layout"
        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3"
      >
        <div
          data-slot="timeline-item-icon"
          className={cn(
            'bg-muted/40 col-start-1 row-start-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border',
            CONTENT_TYPE_CONFIG[item.type]?.accentColor
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div
          data-slot="timeline-item-content-column"
          className="contents min-w-0 sm:col-start-2 sm:row-start-1 sm:block"
        >
          <div
            data-slot="timeline-item-meta"
            className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-2"
          >
            <BadgeControl
              variant={item.reason === 'urgent_decision' ? 'destructive' : 'secondary'}
              className="max-w-full rounded-md break-words whitespace-normal"
            >
              {reasonLabel}
            </BadgeControl>
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTime(getItemTime(item))}
            </span>
            {distanceLabel ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <MapPin className="h-3.5 w-3.5" />
                {distanceLabel}
              </span>
            ) : null}
          </div>
          <div
            data-slot="timeline-item-main-content"
            className="col-span-3 row-start-2 max-w-full min-w-0 sm:col-auto sm:row-auto"
          >
            <h3 className="mt-2 text-base leading-snug font-semibold break-words">
              <SmartLink
                href={item.href}
                onClick={() => onItemSelect?.(item)}
                className="hover:underline"
              >
                {item.title}
              </SmartLink>
            </h3>
            {item.sourceName || item.locationLabel ? (
              <div className="text-muted-foreground mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {item.sourceName ? (
                  <SmartLink
                    href={item.sourceHref ?? item.href}
                    className="hover:text-foreground min-w-0 break-words hover:underline"
                  >
                    {item.sourceName}
                  </SmartLink>
                ) : null}
                {item.locationLabel ? (
                  <span className="inline-flex min-w-0 items-center gap-1 break-words">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {item.locationLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
            {item.description ? (
              <p className="text-muted-foreground mt-2 line-clamp-2 text-sm break-words">
                {item.description}
              </p>
            ) : null}
            <div className="mt-3 flex max-w-full min-w-0 flex-wrap items-center gap-2">
              {item.status ? (
                <BadgeControl
                  variant="outline"
                  shape="rounded"
                  className="max-w-full break-words whitespace-normal"
                >
                  {item.status.replace(/[_-]/g, ' ')}
                </BadgeControl>
              ) : null}
              {item.statsLabel ? (
                <BadgeControl
                  variant="outline"
                  shape="rounded"
                  className="max-w-full break-words whitespace-normal"
                >
                  {item.statsLabel}
                </BadgeControl>
              ) : null}
              {(item.tags ?? []).slice(0, 3).map(tag => (
                <BadgeControl
                  key={tag}
                  variant="outline"
                  className="max-w-full rounded-md font-normal break-words whitespace-normal"
                >
                  #{tag}
                </BadgeControl>
              ))}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="col-start-3 row-start-1 h-8 w-8 shrink-0"
          asChild
        >
          <SmartLink
            href={item.href}
            aria-label={item.primaryActionLabel ?? t('features.timeline.cards.viewDetails')}
          >
            <ArrowUpRight className="h-4 w-4" />
          </SmartLink>
        </Button>
      </div>
    </article>
  );
}

export function CivicTimelineRail({
  sections,
  activeItemId,
  isLoading = false,
  onActiveItemChange,
  onItemSelect,
  queryContext,
}: CivicTimelineRailProps) {
  const { t } = useTranslation();
  const now = useMemo(() => Date.now(), []);

  if (queryContext) {
    const entityIds = queryContext.entityIds ?? [];
    return (
      <div data-testid="civic-timeline-rail">
        <PolityZeroListView<any, { created_at: number; id: string }, any>
          context={{ entityIds, contentTypes: queryContext.contentTypes, now }}
          historyKey="home-civic-timeline"
          estimateSize={190}
          getRowKey={row => row.id}
          toStartRow={row => ({ created_at: row.created_at, id: row.id })}
          getPageQuery={({ limit, start, dir, settled }) => ({
            query: queries.common.timelineFeedPage({
              entityIds,
              contentTypes: queryContext.contentTypes,
              now,
              limit,
              start,
              dir,
            }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          })}
          getSingleQuery={({ id, settled }) => ({
            query: queries.common.timelineFeedById({ id, now }) as never,
            options: { ttl: settled ? ('5m' as const) : ('none' as const) },
          })}
          permalinkID={
            activeItemId?.startsWith('timeline-event:')
              ? activeItemId.slice('timeline-event:'.length)
              : undefined
          }
          renderRow={(row, index) => {
            const item = mapTimelineEvent(row);
            return item ? (
              <TimelineArticle
                item={item}
                revealIndex={index}
                activeItemId={activeItemId}
                onActiveItemChange={onActiveItemChange}
                onItemSelect={onItemSelect}
              />
            ) : null;
          }}
          renderSkeleton={index => <Skeleton key={index} className="h-44 w-full" />}
          renderEmpty={() =>
            isLoading ? (
              <TimelineSkeleton />
            ) : (
              <div className="text-muted-foreground flex min-h-64 items-center justify-center rounded-lg border border-dashed px-4 text-center">
                {t('features.timeline.around.empty', {
                  defaultValue: 'When civic activity appears around you, it will show up here.',
                })}
              </div>
            )
          }
          windowScroll
          contentClassName="before:bg-border relative space-y-3 pl-4 before:absolute before:top-2 before:bottom-2 before:left-[3px] before:w-px"
        />
      </div>
    );
  }

  if (isLoading && sections.length === 0) {
    return <TimelineSkeleton />;
  }

  if (sections.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed px-4 text-center">
        <div>
          <Sparkles className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <h3 className="font-semibold">
            {t('features.timeline.empty.title', { defaultValue: 'No activity yet' })}
          </h3>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            {t('features.timeline.around.empty', {
              defaultValue: 'When civic activity appears around you, it will show up here.',
            })}
          </p>
        </div>
      </div>
    );
  }

  let revealItemIndex = 0;

  return (
    <div className="space-y-7" data-testid="civic-timeline-rail">
      {sections.map(section => (
        <section key={section.id} aria-labelledby={`timeline-section-${section.id}`}>
          <div className="mb-3 flex items-center gap-2">
            <h2
              id={`timeline-section-${section.id}`}
              className="text-muted-foreground text-sm font-semibold uppercase"
            >
              {t(section.labelKey)}
            </h2>
            <div className="bg-border h-px flex-1" />
          </div>

          <div className="before:bg-border relative space-y-3 pl-4 before:absolute before:top-2 before:bottom-2 before:left-[3px] before:w-px">
            {section.items.map(item => {
              const revealIndex = revealItemIndex++;
              return (
                <TimelineArticle
                  key={item.id}
                  item={item}
                  revealIndex={revealIndex}
                  activeItemId={activeItemId}
                  onActiveItemChange={onActiveItemChange}
                  onItemSelect={onItemSelect}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

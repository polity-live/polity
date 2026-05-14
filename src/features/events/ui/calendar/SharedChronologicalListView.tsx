import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { ArrowDown, ArrowUp, Calendar as CalendarIcon } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  getDateKey,
  getListAnchorDateKey,
  getMarkerInsertionIndex,
  getMarkerViewportState,
  type MarkerViewportState,
} from '@/features/calendar/logic/listViewHelpers';
import { cn } from '@/features/shared/utils/utils.ts';

interface SharedChronologicalListViewProps<TItem> {
  items: TItem[];
  selectedDate: Date;
  getItemDate: (item: TItem) => number;
  getItemKey: (item: TItem) => string;
  renderItem: (item: TItem) => ReactNode;
  emptyText: string;
}

function groupByDate<TItem>(
  items: readonly TItem[],
  getItemDate: (item: TItem) => number
): Map<string, TItem[]> {
  const map = new Map<string, TItem[]>();
  const sorted = [...items].sort((left, right) => getItemDate(left) - getItemDate(right));

  for (const item of sorted) {
    const key = getDateKey(new Date(getItemDate(item)));
    const currentItems = map.get(key);

    if (currentItems) {
      currentItems.push(item);
      continue;
    }

    map.set(key, [item]);
  }

  return map;
}

export function SharedChronologicalListView<TItem>({
  items,
  selectedDate,
  getItemDate,
  getItemKey,
  renderItem,
  emptyText,
}: SharedChronologicalListViewProps<TItem>) {
  const { t, language } = useTranslation();
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const daySectionRefs = useRef(new Map<string, HTMLDivElement>());
  const todayMarkerRef = useRef<HTMLDivElement | null>(null);
  const [todayMarkerState, setTodayMarkerState] = useState<MarkerViewportState>('visible');
  const groupedEntries = useMemo(
    () => Array.from(groupByDate(items, getItemDate).entries()),
    [getItemDate, items]
  );
  const todayDateKey = getDateKey(new Date());
  const dateKeys = useMemo(() => groupedEntries.map(([dateKey]) => dateKey), [groupedEntries]);
  const todayMarkerIndex = useMemo(() => getMarkerInsertionIndex(dateKeys, new Date()), [dateKeys]);

  const updateTodayMarkerState = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement | null;
    const marker = todayMarkerRef.current;

    if (!viewport || !marker) {
      return;
    }

    const nextState = getMarkerViewportState(
      marker.getBoundingClientRect(),
      viewport.getBoundingClientRect()
    );

    setTodayMarkerState(previousState => (previousState === nextState ? previousState : nextState));
  }, []);

  useEffect(() => {
    const isSelectedDateToday = getDateKey(selectedDate) === todayDateKey;
    const anchorElement = isSelectedDateToday
      ? todayMarkerRef.current
      : (() => {
          const anchorDateKey = getListAnchorDateKey(dateKeys, selectedDate);
          return anchorDateKey ? daySectionRefs.current.get(anchorDateKey) : null;
        })();

    if (!anchorElement) {
      return;
    }

    anchorElement.scrollIntoView({ block: 'start' });
    updateTodayMarkerState();
  }, [dateKeys, groupedEntries, selectedDate, todayDateKey, updateTodayMarkerState]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement | null;

    if (!viewport || !todayMarkerRef.current) {
      return;
    }

    updateTodayMarkerState();
    viewport.addEventListener('scroll', updateTodayMarkerState, { passive: true });
    window.addEventListener('resize', updateTodayMarkerState);

    return () => {
      viewport.removeEventListener('scroll', updateTodayMarkerState);
      window.removeEventListener('resize', updateTodayMarkerState);
    };
  }, [groupedEntries, updateTodayMarkerState]);

  const scrollToTodayMarker = useCallback(() => {
    todayMarkerRef.current?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    });
  }, []);

  const renderTodayMarker = useCallback(
    () => (
      <div ref={todayMarkerRef} className="py-1">
        <div className="flex items-center gap-3">
          <div className="bg-border h-px flex-1" />
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase',
              todayMarkerState === 'visible'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-background/95 text-muted-foreground'
            )}
          >
            {t('features.calendar.today')}
          </span>
          <div className="bg-border h-px flex-1" />
        </div>
      </div>
    ),
    [t, todayMarkerState]
  );

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center">
          <CalendarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>{emptyText}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      {todayMarkerState !== 'visible' && (
        <div className="pointer-events-none absolute top-3 right-3 z-20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-background/95 supports-[backdrop-filter]:bg-background/80 pointer-events-auto rounded-full shadow-sm backdrop-blur"
            onClick={scrollToTodayMarker}
          >
            {todayMarkerState === 'above' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
            {t('features.calendar.today')}
          </Button>
        </div>
      )}

      <ScrollArea ref={scrollAreaRef} className="h-[700px]">
        <div className="space-y-6">
          {groupedEntries.map(([dateKey, dayItems], index) => {
            const isToday = dateKey === todayDateKey;
            const shouldRenderTodayMarker = index === todayMarkerIndex;
            const date = new Date(`${dateKey}T00:00:00`);

            return (
              <Fragment key={dateKey}>
                {shouldRenderTodayMarker ? renderTodayMarker() : null}
                <div
                  ref={element => {
                    if (element) {
                      daySectionRefs.current.set(dateKey, element);
                      return;
                    }

                    daySectionRefs.current.delete(dateKey);
                  }}
                >
                  <h3
                    className={cn(
                      'text-muted-foreground mb-3 text-sm font-semibold',
                      isToday && 'text-primary'
                    )}
                  >
                    {date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                    {isToday && (
                      <span className="text-primary ml-2">({t('features.calendar.today')})</span>
                    )}
                  </h3>
                  <div className="space-y-3">
                    {dayItems.map(item => (
                      <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>
                    ))}
                  </div>
                </div>
              </Fragment>
            );
          })}
          {todayMarkerIndex === groupedEntries.length ? renderTodayMarker() : null}
        </div>
      </ScrollArea>
    </div>
  );
}

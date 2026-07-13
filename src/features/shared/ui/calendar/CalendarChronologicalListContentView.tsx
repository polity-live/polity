import { Fragment, useCallback, useEffect, useMemo, type CSSProperties } from 'react';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { ArrowDown, ArrowUp, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils.ts';
import { usePolityLocalVirtualizer } from '@/features/shared/virtualization';
import { getListAnchorDateKey } from '@/features/shared/logic/calendarListHelpers';

export interface CalendarChronologicalListContentViewProps {
  daySectionRefs: any;
  emptyText: any;
  getItemKey: any;
  groupedEntries: any;
  itemMotion: 'none' | 'place';
  items: any;
  language: any;
  renderItem: any;
  selectedDate: Date;
  scrollAreaRef: any;
  scrollToTodayMarker: any;
  t: any;
  todayDateKey: any;
  todayMarkerIndex: any;
  todayMarkerRef: any;
  todayMarkerState: any;
}

export function CalendarChronologicalListContentView({
  daySectionRefs,
  emptyText,
  getItemKey,
  groupedEntries,
  itemMotion,
  items,
  language,
  renderItem,
  selectedDate,
  scrollAreaRef,
  scrollToTodayMarker,
  t,
  todayDateKey,
  todayMarkerIndex,
  todayMarkerRef,
  todayMarkerState,
}: CalendarChronologicalListContentViewProps) {
  const getScrollElement = useCallback(
    () =>
      scrollAreaRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      ) as HTMLDivElement | null,
    [scrollAreaRef]
  );
  const dateKeys = useMemo(
    () => groupedEntries.map(([dateKey]: [string, any[]]) => dateKey),
    [groupedEntries]
  );
  const itemOffsets = useMemo(() => {
    let offset = 0;
    return groupedEntries.map(([, dayItems]: [string, any[]]) => {
      const current = offset;
      offset += dayItems.length;
      return current;
    });
  }, [groupedEntries]);
  const dayVirtualizer = usePolityLocalVirtualizer({
    count: groupedEntries.length + (todayMarkerIndex === groupedEntries.length ? 1 : 0),
    getScrollElement,
    estimateSize: () => 320,
    overscan: 3,
  });

  useEffect(() => {
    const anchorKey = getListAnchorDateKey(dateKeys, selectedDate);
    const anchorIndex = anchorKey ? dateKeys.indexOf(anchorKey) : -1;
    if (anchorIndex >= 0) dayVirtualizer.scrollToIndex(anchorIndex, { align: 'start' });
  }, [dateKeys, dayVirtualizer, selectedDate]);

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
        <div className="relative w-full" style={{ height: dayVirtualizer.getTotalSize() }}>
          {dayVirtualizer.getVirtualItems().map(virtualDay => {
            const index = virtualDay.index;
            const entry = groupedEntries[index] as [string, any[]] | undefined;
            if (!entry) {
              return (
                <div
                  key="today-marker-tail"
                  data-index={index}
                  ref={dayVirtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualDay.start}px)` }}
                >
                  {renderTodayMarker()}
                </div>
              );
            }
            const [dateKey, dayItems] = entry;
            const isToday = dateKey === todayDateKey;
            const shouldRenderTodayMarker = index === todayMarkerIndex;
            const date = new Date(`${dateKey}T00:00:00`);
            let itemRenderIndex = itemOffsets[index] ?? 0;

            return (
              <div
                key={dateKey}
                data-index={index}
                ref={dayVirtualizer.measureElement}
                className="absolute top-0 left-0 w-full pb-6"
                style={{ transform: `translateY(${virtualDay.start}px)` }}
              >
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
                    {dayItems.map((item: any) => {
                      const itemKey = getItemKey(item);
                      const motionIndex = itemRenderIndex;
                      itemRenderIndex += 1;

                      if (itemMotion === 'place') {
                        return (
                          <div
                            key={itemKey}
                            className="civic-load-card-place"
                            style={
                              {
                                '--civic-load-index': Math.min(motionIndex, 11),
                              } as CSSProperties
                            }
                          >
                            {renderItem(item)}
                          </div>
                        );
                      }

                      return <Fragment key={itemKey}>{renderItem(item)}</Fragment>;
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

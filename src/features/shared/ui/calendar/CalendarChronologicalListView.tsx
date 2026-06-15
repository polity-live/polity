import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  getDateKey,
  getListAnchorDateKey,
  getMarkerInsertionIndex,
  getMarkerViewportState,
  type MarkerViewportState,
} from '@/features/shared/logic/calendarListHelpers';
import { CalendarChronologicalListContentView } from './CalendarChronologicalListContentView';

export interface CalendarChronologicalListViewProps<TItem> {
  items: TItem[];
  selectedDate: Date;
  getItemDate: (item: TItem) => number;
  getItemKey: (item: TItem) => string;
  renderItem: (item: TItem) => ReactNode;
  emptyText: string;
  itemMotion?: 'none' | 'place';
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

export function CalendarChronologicalListView<TItem>({
  items,
  selectedDate,
  getItemDate,
  getItemKey,
  renderItem,
  emptyText,
  itemMotion = 'none',
}: CalendarChronologicalListViewProps<TItem>) {
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

  return (
    <CalendarChronologicalListContentView
      daySectionRefs={daySectionRefs}
      emptyText={emptyText}
      getItemKey={getItemKey}
      groupedEntries={groupedEntries}
      itemMotion={itemMotion}
      items={items}
      language={language}
      renderItem={renderItem}
      scrollAreaRef={scrollAreaRef}
      scrollToTodayMarker={scrollToTodayMarker}
      t={t}
      todayDateKey={todayDateKey}
      todayMarkerIndex={todayMarkerIndex}
      todayMarkerRef={todayMarkerRef}
      todayMarkerState={todayMarkerState}
    />
  );
}

export const SharedChronologicalListView = CalendarChronologicalListView;

export const WEEK_VIEW_HOUR_HEIGHT = 64;
export const WEEK_VIEW_SLOT_MINUTES = 30;
export const WEEK_VIEW_SLOTS_PER_DAY = 48;
export const WEEK_VIEW_DAY_MINUTES = 24 * 60;
export const WEEK_VIEW_SLOT_HEIGHT = (WEEK_VIEW_HOUR_HEIGHT * WEEK_VIEW_SLOT_MINUTES) / 60;
export const DEFAULT_WEEK_SELECTION_SLOT_SPAN = 2;
export const DEFAULT_WEEK_VIEW_VISIBLE_START_HOUR = 8;
export const DEFAULT_WEEK_VIEW_SCROLL_TOP =
  DEFAULT_WEEK_VIEW_VISIBLE_START_HOUR * WEEK_VIEW_HOUR_HEIGHT;

export interface WeekGridEvent {
  id: string;
  start_date: Date | number | string;
  end_date?: Date | number | string | null;
}

export interface WeekEventLayout<T extends WeekGridEvent = WeekGridEvent> {
  event: T;
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
  column: number;
  columnCount: number;
}

export interface WeekSelectionRange {
  startSlot: number;
  endSlot: number;
}

export interface DayTimeLayout<T> {
  item: T;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
  column: number;
  columnCount: number;
}

function clampMinute(value: number): number {
  return Math.min(WEEK_VIEW_DAY_MINUTES, Math.max(0, value));
}

function clampSlot(value: number): number {
  return Math.min(WEEK_VIEW_SLOTS_PER_DAY, Math.max(0, value));
}

export function isSameWeekGridDay(dateValue: Date | number | string, day: Date): boolean {
  const date = new Date(dateValue);

  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

export function getWeekGridDays(selectedDate: Date): Date[] {
  const start = new Date(selectedDate);
  const day = start.getDay();

  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function getMinutesSinceMidnight(dateValue: Date | number | string): number {
  const date = new Date(dateValue);

  return date.getHours() * 60 + date.getMinutes();
}

export function getWeekEventRange(event: WeekGridEvent): {
  startMinute: number;
  endMinute: number;
} {
  const startMinute = clampMinute(getMinutesSinceMidnight(event.start_date));
  const rawEndMinute =
    event.end_date !== null && event.end_date !== undefined
      ? getMinutesSinceMidnight(event.end_date)
      : startMinute + WEEK_VIEW_SLOT_MINUTES;
  const endMinute = clampMinute(Math.max(startMinute + WEEK_VIEW_SLOT_MINUTES, rawEndMinute));

  return {
    startMinute,
    endMinute,
  };
}

function getMinuteRange(
  startTimestamp: Date | number | string,
  endTimestamp?: Date | number | string | null
): {
  startMinute: number;
  endMinute: number;
} {
  const startMinute = clampMinute(getMinutesSinceMidnight(startTimestamp));
  const rawEndMinute =
    typeof endTimestamp === 'number' && endTimestamp > 0
      ? getMinutesSinceMidnight(endTimestamp)
      : startMinute + WEEK_VIEW_SLOT_MINUTES;
  const endMinute = clampMinute(Math.max(startMinute + WEEK_VIEW_SLOT_MINUTES, rawEndMinute));

  return {
    startMinute,
    endMinute,
  };
}

function layoutCluster<T>(
  items: readonly { item: T; startMinute: number; endMinute: number }[]
): DayTimeLayout<T>[] {
  const columnEndMinutes: number[] = [];
  let maxColumnCount = 0;

  const positioned = items.map(item => {
    const reusableColumnIndex = columnEndMinutes.findIndex(
      endMinute => endMinute <= item.startMinute
    );
    const column = reusableColumnIndex === -1 ? columnEndMinutes.length : reusableColumnIndex;

    columnEndMinutes[column] = item.endMinute;
    maxColumnCount = Math.max(maxColumnCount, columnEndMinutes.length);

    return {
      ...item,
      column,
    };
  });

  return positioned.map(item => ({
    item: item.item,
    startMinute: item.startMinute,
    endMinute: item.endMinute,
    top: (item.startMinute / WEEK_VIEW_SLOT_MINUTES) * WEEK_VIEW_SLOT_HEIGHT,
    height: Math.max(
      WEEK_VIEW_SLOT_HEIGHT,
      ((item.endMinute - item.startMinute) / WEEK_VIEW_SLOT_MINUTES) * WEEK_VIEW_SLOT_HEIGHT
    ),
    column: item.column,
    columnCount: maxColumnCount,
  }));
}

export function buildDayTimeLayout<T>(
  items: readonly T[],
  getStartTimestamp: (item: T) => Date | number | string,
  getEndTimestamp: (item: T) => Date | number | string | null | undefined
): DayTimeLayout<T>[] {
  const normalizedItems = items
    .map(item => ({
      item,
      ...getMinuteRange(getStartTimestamp(item), getEndTimestamp(item)),
    }))
    .sort((left, right) => {
      if (left.startMinute !== right.startMinute) {
        return left.startMinute - right.startMinute;
      }

      return left.endMinute - right.endMinute;
    });

  const layout: DayTimeLayout<T>[] = [];
  let cluster: typeof normalizedItems = [];
  let clusterMaxEnd = -1;

  normalizedItems.forEach(item => {
    if (cluster.length > 0 && item.startMinute >= clusterMaxEnd) {
      layout.push(...layoutCluster(cluster));
      cluster = [];
      clusterMaxEnd = -1;
    }

    cluster.push(item);
    clusterMaxEnd = Math.max(clusterMaxEnd, item.endMinute);
  });

  if (cluster.length > 0) {
    layout.push(...layoutCluster(cluster));
  }

  return layout;
}

export function buildWeekEventLayout<T extends WeekGridEvent>(
  events: readonly T[],
  weekDays: readonly Date[]
): WeekEventLayout<T>[] {
  const layout: WeekEventLayout<T>[] = [];

  weekDays.forEach((day, dayIndex) => {
    const dayEvents = events.filter(event => isSameWeekGridDay(event.start_date, day));
    const dayLayout = buildDayTimeLayout<T>(
      dayEvents,
      (event: T): Date | number | string => event.start_date,
      (event: T): Date | number | string | null | undefined => event.end_date
    );

    layout.push(
      ...dayLayout.map(item => ({
        event: item.item,
        dayIndex,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        top: item.top,
        height: item.height,
        column: item.column,
        columnCount: item.columnCount,
      }))
    );
  });

  return layout;
}

export function getWeekSelectionRange(
  anchorSlot: number,
  targetSlot: number,
  defaultSlotSpan = DEFAULT_WEEK_SELECTION_SLOT_SPAN
): WeekSelectionRange {
  const safeAnchor = clampSlot(anchorSlot);
  const safeTarget = clampSlot(targetSlot);

  if (safeAnchor === safeTarget) {
    return {
      startSlot: safeAnchor,
      endSlot: clampSlot(safeAnchor + defaultSlotSpan),
    };
  }

  return {
    startSlot: clampSlot(Math.min(safeAnchor, safeTarget)),
    endSlot: clampSlot(Math.max(safeAnchor, safeTarget) + 1),
  };
}

export function getDateForWeekSlot(day: Date, slotIndex: number): Date {
  const date = new Date(day);
  const clampedSlotIndex = clampSlot(slotIndex);
  const minutes = clampedSlotIndex * WEEK_VIEW_SLOT_MINUTES;

  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

  return date;
}

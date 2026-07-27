import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';
import {
  buildWeekEventLayout,
  DEFAULT_WEEK_VIEW_SCROLL_TOP,
  getDateForWeekSlot,
  getWeekGridDays,
  getWeekSelectionRange,
  WEEK_VIEW_HOUR_HEIGHT,
  WEEK_VIEW_SLOT_HEIGHT,
  WEEK_VIEW_SLOTS_PER_DAY,
} from '@/features/shared/ui/calendar';

export interface WeekSelectionDraft {
  dayIndex: number;
  anchorSlot: number;
  currentSlot: number;
}

export interface WeekSelectionState {
  dayIndex: number;
  startSlot: number;
  endSlot: number;
}

interface UseSharedWeekViewControllerArgs {
  selectedDate: Date;
  events: CalendarEvent[];
}

function getPointerSlotIndex(event: PointerEvent<HTMLDivElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const offsetY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height - 1);

  return Math.min(WEEK_VIEW_SLOTS_PER_DAY - 1, Math.floor(offsetY / WEEK_VIEW_SLOT_HEIGHT));
}

export function useSharedWeekViewController({
  selectedDate,
  events,
}: UseSharedWeekViewControllerArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draftSelectionRef = useRef<WeekSelectionDraft | null>(null);
  const [draftSelection, setDraftSelection] = useState<WeekSelectionDraft | null>(null);
  const [selection, setSelection] = useState<WeekSelectionState | null>(null);

  const weekDays = useMemo(() => getWeekGridDays(selectedDate), [selectedDate]);
  const weekStartKey = weekDays[0]?.getTime() ?? 0;
  const weekEventLayout = useMemo(() => buildWeekEventLayout(events, weekDays), [events, weekDays]);
  const dayLayouts = useMemo(
    () =>
      weekDays.map((_, dayIndex) => weekEventLayout.filter(layout => layout.dayIndex === dayIndex)),
    [weekDays, weekEventLayout]
  );
  const hourMarkers = useMemo(() => Array.from({ length: 25 }, (_, hour) => hour), []);
  const halfHourMarkers = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => hour * WEEK_VIEW_HOUR_HEIGHT + WEEK_VIEW_SLOT_HEIGHT),
    []
  );

  const clearSelection = useCallback(() => {
    draftSelectionRef.current = null;
    setDraftSelection(null);
    setSelection(null);
  }, []);

  const finalizeDraftSelection = useCallback((dayIndex?: number, slotIndex?: number) => {
    const currentDraft = draftSelectionRef.current;

    if (!currentDraft) {
      return;
    }

    const targetSlot =
      dayIndex === currentDraft.dayIndex && slotIndex !== undefined
        ? slotIndex
        : currentDraft.currentSlot;

    draftSelectionRef.current = null;
    setDraftSelection(null);
    setSelection({
      dayIndex: currentDraft.dayIndex,
      ...getWeekSelectionRange(currentDraft.anchorSlot, targetSlot),
    });
  }, []);

  useEffect(() => {
    draftSelectionRef.current = draftSelection;
  }, [draftSelection]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, weekStartKey]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.scrollTop = DEFAULT_WEEK_VIEW_SCROLL_TOP;
  }, [weekStartKey]);

  useEffect(() => {
    if (!draftSelection) {
      return;
    }

    const handlePointerUp = () => {
      finalizeDraftSelection();
    };

    const handlePointerCancel = () => {
      clearSelection();
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [clearSelection, draftSelection, finalizeDraftSelection]);

  useEffect(() => {
    if (!selection) {
      return;
    }

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        clearSelection();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [clearSelection, selection]);

  const displayedSelection = useMemo(() => {
    if (draftSelection) {
      return {
        dayIndex: draftSelection.dayIndex,
        ...getWeekSelectionRange(draftSelection.anchorSlot, draftSelection.currentSlot),
      };
    }

    return selection;
  }, [draftSelection, selection]);

  const selectedRange = useMemo(() => {
    if (!selection) {
      return null;
    }

    const day = weekDays[selection.dayIndex];

    if (!day) {
      return null;
    }

    return {
      start: getDateForWeekSlot(day, selection.startSlot),
      end: getDateForWeekSlot(day, selection.endSlot),
    };
  }, [selection, weekDays]);

  const handleDayPointerDown = useCallback(
    (dayIndex: number) => (event: PointerEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      const slotIndex = getPointerSlotIndex(event);

      event.preventDefault();
      setSelection(null);
      const nextDraft = {
        dayIndex,
        anchorSlot: slotIndex,
        currentSlot: slotIndex,
      };
      draftSelectionRef.current = nextDraft;
      setDraftSelection(nextDraft);
    },
    []
  );

  const handleDayPointerMove = useCallback(
    (dayIndex: number) => (event: PointerEvent<HTMLDivElement>) => {
      const currentDraft = draftSelectionRef.current;

      if (!currentDraft || currentDraft.dayIndex !== dayIndex) {
        return;
      }

      const slotIndex = getPointerSlotIndex(event);

      if (slotIndex === currentDraft.currentSlot) {
        return;
      }

      const nextDraft = {
        ...currentDraft,
        currentSlot: slotIndex,
      };
      draftSelectionRef.current = nextDraft;
      setDraftSelection(nextDraft);
    },
    []
  );

  const handleDayPointerUp = useCallback(
    (dayIndex: number) => (event: PointerEvent<HTMLDivElement>) => {
      if (!draftSelectionRef.current || draftSelectionRef.current.dayIndex !== dayIndex) {
        return;
      }

      finalizeDraftSelection(dayIndex, getPointerSlotIndex(event));
    },
    [finalizeDraftSelection]
  );

  return {
    containerRef,
    weekDays,
    dayLayouts,
    hourMarkers,
    halfHourMarkers,
    displayedSelection,
    selection,
    selectedRange,
    clearSelection,
    handleDayPointerDown,
    handleDayPointerMove,
    handleDayPointerUp,
  };
}

export type SharedWeekViewController = ReturnType<typeof useSharedWeekViewController>;

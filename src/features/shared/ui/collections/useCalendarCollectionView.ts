import { useEffect, useRef } from 'react';
import { useCollectionView } from './useCollectionView';
import type { CollectionArea } from '@/zero/preferences/workspace-schema';
import type { CalendarViewMode } from '@/features/events/hooks/useCalendarView';
export function useCalendarCollectionView(
  area: CollectionArea,
  mode: CalendarViewMode,
  setMode: (mode: CalendarViewMode) => void
) {
  const preference = useCollectionView(area);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || preference.isLoading) return;
    initialized.current = true;
    if (preference.hasPreference && (mode === 'list' || mode === 'compact'))
      setMode(preference.view === 'compact' ? 'compact' : 'list');
  }, [mode, preference.isLoading, preference.hasPreference, preference.view, setMode]);
  return (next: CalendarViewMode) => {
    initialized.current = true;
    setMode(next);
    if (next === 'list' || next === 'compact')
      preference.setView(next === 'list' ? 'cards' : 'compact');
  };
}

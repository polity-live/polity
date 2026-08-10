import { CalendarExportButton as CalendarExportButtonControl } from '@/features/shared/ui/calendar';
import { downloadICalFile } from '@/features/events/logic/icalExport';
import type { CalendarEvent } from '@/features/events/hooks/useCalendarView';

interface CalendarExportButtonProps {
  events: CalendarEvent[];
  filename?: string;
  'data-action-id'?: string;
}

export function CalendarExportButton({
  events,
  filename,
  'data-action-id': dataActionId,
}: CalendarExportButtonProps) {
  const handleExport = () => {
    const icalEvents = events.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description ?? null,
      location_name: e.location ?? null,
      start_date:
        typeof e.start_date === 'number' ? e.start_date : new Date(e.start_date).getTime(),
      end_date: typeof e.end_date === 'number' ? e.end_date : new Date(e.end_date).getTime(),
      creator: e.organizer ? { name: e.organizer.name } : null,
    }));
    downloadICalFile(icalEvents, filename);
  };

  return <CalendarExportButtonControl onExport={handleExport} data-action-id={dataActionId} />;
}

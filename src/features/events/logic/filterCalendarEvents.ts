export interface FilterableCalendarEvent {
  start_date: number;
  title: string;
  hashtags?: { tag: string }[];
  groupName?: string;
  group_id?: string | null;
  location?: string;
}

export interface CalendarEventFilterOptions {
  searchQuery: string;
  dateFilter: string;
  selectedGroupId?: string;
}

function isSameCalendarDay(timestamp: number, dateFilter: string): boolean {
  const eventDate = new Date(timestamp);
  const filterDate = new Date(`${dateFilter}T00:00:00`);

  return (
    eventDate.getFullYear() === filterDate.getFullYear() &&
    eventDate.getMonth() === filterDate.getMonth() &&
    eventDate.getDate() === filterDate.getDate()
  );
}

export function filterCalendarEvents<T extends FilterableCalendarEvent>(
  events: readonly T[],
  options: CalendarEventFilterOptions
): T[] {
  const { searchQuery, dateFilter, selectedGroupId } = options;

  if (!searchQuery && !dateFilter && !selectedGroupId) {
    return [...events];
  }

  const lowerQuery = searchQuery.toLowerCase();

  return events.filter(event => {
    if (selectedGroupId && event.group_id !== selectedGroupId) {
      return false;
    }

    if (dateFilter && !isSameCalendarDay(event.start_date, dateFilter)) {
      return false;
    }

    if (lowerQuery) {
      const titleMatch = event.title.toLowerCase().includes(lowerQuery);
      const hashtagMatch = event.hashtags?.some(hashtag =>
        hashtag.tag.toLowerCase().includes(lowerQuery)
      );
      const groupMatch = event.groupName?.toLowerCase().includes(lowerQuery);
      const locationMatch = event.location?.toLowerCase().includes(lowerQuery);

      if (!titleMatch && !hashtagMatch && !groupMatch && !locationMatch) {
        return false;
      }
    }

    return true;
  });
}

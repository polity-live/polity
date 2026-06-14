import { FormControlLabel } from '@/features/shared/ui/form';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useAllEvents } from '@/zero/events/useEventState';
import { useMemo } from 'react';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface EventSearchInputProps {
  value: string;
  onChange: (eventId: string) => void;
  label?: string;
  placeholder?: string;
  /** Only show events belonging to this group */
  filterByGroupId?: string;
}

export function EventSearchInput({
  value,
  onChange,
  label,
  placeholder = translateText('generated.inline.0042_search_for_an_event_2c0dc7bd'),
  filterByGroupId,
}: EventSearchInputProps) {
  const { events } = useAllEvents();

  const items = useMemo(() => {
    const filtered = filterByGroupId ? events.filter(e => e.group_id === filterByGroupId) : events;
    return toTypeaheadItems(
      filtered,
      'event',
      e => e.title || 'Event',
      e => (typeof e.description === 'string' ? e.description.substring(0, 60) : undefined),
      undefined,
      e => `/event/${e.id}`
    );
  }, [events, filterByGroupId]);

  const handleChange = (item: TypeaheadItem | null) => {
    onChange(item?.id ?? '');
  };

  return (
    <div>
      {label && <FormControlLabel className="mb-2 block">{label}</FormControlLabel>}
      <TypeaheadSearch
        items={items}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
      />
    </div>
  );
}

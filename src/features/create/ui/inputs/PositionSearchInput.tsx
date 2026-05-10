import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { usePositionsWithGroups } from '@/zero/events/useEventState';
import { useMemo } from 'react';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { CreateTypeaheadField } from '../CreateFields';

interface PositionSearchInputProps {
  value: string;
  onChange: (positionId: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  /** Filter positions to only these groups */
  groupIds?: string[];
  /** Filter positions to this event's groups */
  eventId?: string;
  required?: boolean;
}

export function PositionSearchInput({
  value,
  onChange,
  label,
  hint,
  placeholder = 'Search for a position...',
  groupIds,
  required,
}: PositionSearchInputProps) {
  const { positions } = usePositionsWithGroups();

  const filteredPositions = useMemo(() => {
    if (!positions) return [];
    if (!groupIds || groupIds.length === 0) return positions;
    return positions.filter(p => p.group_id && groupIds.includes(p.group_id));
  }, [positions, groupIds]);

  const items = useMemo(
    () =>
      toTypeaheadItems(
        filteredPositions,
        'position',
        p => p.title || 'Position',
        p => (typeof p.description === 'string' ? p.description.substring(0, 60) : undefined)
      ),
    [filteredPositions]
  );

  const handleChange = (item: TypeaheadItem | null) => {
    onChange(item?.id ?? '');
  };

  return (
    <CreateTypeaheadField
      items={items}
      value={value || undefined}
      onChange={handleChange}
      label={label}
      hint={hint}
      required={required}
      placeholder={placeholder}
    />
  );
}

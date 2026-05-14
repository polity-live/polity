import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';

interface CalendarGroupFilterProps {
  items: TypeaheadItem[];
  selectedGroupId: string;
  onGroupChange: (groupId: string) => void;
}

export function CalendarGroupFilter({
  items,
  selectedGroupId,
  onGroupChange,
}: CalendarGroupFilterProps) {
  const { t } = useTranslation();

  return (
    <TypeaheadSearch
      items={items}
      value={selectedGroupId || undefined}
      onChange={item => onGroupChange(item?.id ?? '')}
      placeholder={t('features.calendar.search.groupPlaceholder')}
      className="w-full"
    />
  );
}

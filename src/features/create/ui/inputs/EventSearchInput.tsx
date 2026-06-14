import { translate as translateText } from '@/features/shared/hooks/use-translation';
interface EventSearchInputProps {
  value: string;
  onChange: (eventId: string) => void;
  label?: string;
  placeholder?: string;
  /** Only show events belonging to this group */
  filterByGroupId?: string;
}

import { useEventSearchInputController } from './useEventSearchInputController';
import { EventSearchInputView } from './EventSearchInputView';

export function EventSearchInput({
  value,
  onChange,
  label,
  placeholder = translateText('generated.inline.0042_search_for_an_event_2c0dc7bd'),
  filterByGroupId,
}: EventSearchInputProps) {
  const viewProps = useEventSearchInputController({
    value,
    onChange,
    label,
    placeholder,
    filterByGroupId,
  });

  return <EventSearchInputView {...viewProps} />;
}

/**
 * Event Edit Component
 *
 * Complete event editing UI with authorization checks,
 * loading states, and form management.
 */

interface EventEditProps {
  eventId: string;
  mode?: 'create' | 'edit';
  defaultTab?: 'basic-info' | 'time-series' | 'event-type';
  onTabChange?: (tab: 'basic-info' | 'time-series' | 'event-type') => void;
}

import { useEventEditController } from './useEventEditController';
import { EventEditView } from './EventEditView';

export function EventEdit({ eventId, mode = 'edit', defaultTab, onTabChange }: EventEditProps) {
  const viewProps = useEventEditController({ eventId, mode, defaultTab, onTabChange });

  return <EventEditView {...viewProps} />;
}

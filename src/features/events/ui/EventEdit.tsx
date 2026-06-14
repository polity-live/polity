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
}

import { useEventEditController } from './useEventEditController';
import { EventEditView } from './EventEditView';

export function EventEdit({ eventId, mode = 'edit', defaultTab }: EventEditProps) {
  const viewProps = useEventEditController({ eventId, mode, defaultTab });

  return <EventEditView {...viewProps} />;
}

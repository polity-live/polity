'use client';

import { useAccreditationSectionController } from '../hooks/useAccreditationSectionController';
import { AccreditationSectionView } from './AccreditationSectionView';

interface AccreditationSectionProps {
  eventId: string;
  agendaItemId: string;
}

export function AccreditationSection({ eventId, agendaItemId }: AccreditationSectionProps) {
  const controller = useAccreditationSectionController({ eventId, agendaItemId });

  return <AccreditationSectionView controller={controller} />;
}

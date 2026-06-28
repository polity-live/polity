import { EntityPageFrame } from '@/features/shared/ui/layout';

import { useMeetingDetailPage } from './hooks/useMeetingDetailPage';
import { MeetingPageView } from './ui/MeetingPageView';

interface MeetingPageProps {
  meetingId: string;
}

export function MeetingPage({ meetingId }: MeetingPageProps) {
  const page = useMeetingDetailPage(meetingId);

  return (
    <EntityPageFrame>
      <MeetingPageView {...page} />
    </EntityPageFrame>
  );
}

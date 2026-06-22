import type { ComponentProps } from 'react';

import { LoadingState } from '@/features/shared/ui/feedback';
import { StatsBar } from '@/features/shared/ui/layout';
import { InfoTabs } from '@/features/shared/ui/wiki/InfoTabs.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { MeetingActions } from './MeetingActions';
import { MeetingDetails } from './MeetingDetails';
import { MeetingHeader } from './MeetingHeader';
import { MeetingParticipants } from './MeetingParticipants';

type MeetingPageViewProps =
  | { state: 'loading' }
  | { state: 'not-found' }
  | {
      state: 'ready';
      title: string;
      isPublic: boolean;
      owner: {
        id: string;
        name?: string;
        avatar?: string;
      };
      meetingType: string;
      bookingCount: number;
      meetingId: string;
      description: string;
      isOwner: boolean;
      hasBooked: boolean;
      isAvailable: boolean;
      isPast: boolean;
      startTime: string | number;
      endTime: string | number;
      participants: ComponentProps<typeof MeetingParticipants>['bookings'];
      about?: ComponentProps<typeof InfoTabs>['about'];
      onBook: () => void;
      onCancelBooking: () => void;
      onNavigateCalendar: () => void;
      onNavigateEdit: () => void;
    };

export function MeetingPageView(props: MeetingPageViewProps) {
  const { t } = useTranslation();

  if (props.state === 'loading') {
    return <LoadingState label={t('features.meet.page.loadingMeeting')} className="py-12" />;
  }

  if (props.state === 'not-found') {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-4 text-2xl font-bold">{t('features.meet.page.notFound')}</h1>
        <p className="text-muted-foreground">{t('features.meet.page.notFoundDescription')}</p>
      </div>
    );
  }

  return (
    <>
      <MeetingHeader
        title={props.title}
        isPublic={props.isPublic}
        owner={props.owner}
        meetingType={props.meetingType}
      />

      <StatsBar
        items={[{ value: props.bookingCount, label: t('components.labels.participants') }]}
      />

      <MeetingActions
        meetingId={props.meetingId}
        title={props.title}
        description={props.description}
        isOwner={props.isOwner}
        hasBooked={props.hasBooked}
        isAvailable={props.isAvailable}
        isPast={props.isPast}
        onBook={props.onBook}
        onCancelBooking={props.onCancelBooking}
        onNavigateCalendar={props.onNavigateCalendar}
        onNavigateEdit={props.onNavigateEdit}
      />

      <MeetingDetails
        startTime={props.startTime}
        endTime={props.endTime}
        meetingType={props.meetingType}
        isAvailable={props.isAvailable}
        isPast={props.isPast}
      />

      <MeetingParticipants bookings={props.participants} count={props.bookingCount} />

      {props.about ? <InfoTabs about={props.about} contact={{}} className="mb-12" /> : null}
    </>
  );
}

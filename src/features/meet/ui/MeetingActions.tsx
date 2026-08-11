import { Button } from '@/features/shared/ui/ui/button';
import {
  ActionBar,
  ResponsiveActionLabel,
  compactActionButtonClassName,
} from '@/features/shared/ui/layout';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { Calendar, Settings, UserPlus, UserMinus } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface MeetingActionsProps {
  meetingId: string;
  title: string;
  description: string;
  isAuthenticated: boolean;
  isOwner: boolean;
  hasBooked: boolean;
  isAvailable: boolean;
  isPast: boolean;
  onBook?: () => void;
  onCancelBooking?: () => void;
  onNavigateCalendar: () => void;
  onNavigateEdit: () => void;
}

export function MeetingActions({
  meetingId,
  title,
  description,
  isAuthenticated,
  isOwner,
  hasBooked,
  isAvailable,
  isPast,
  onBook,
  onCancelBooking,
  onNavigateCalendar,
  onNavigateEdit,
}: MeetingActionsProps) {
  const { t } = useTranslation();

  return (
    <ActionBar>
      {isAuthenticated ? (
        <>
          {!isOwner && !hasBooked && isAvailable && onBook ? (
            <Button
              data-action-id="meet.actions.booking.create"
              onClick={onBook}
              className={compactActionButtonClassName}
              aria-label={t('features.meet.page.bookMeeting')}
            >
              <UserPlus className="mr-0 h-4 w-4 sm:mr-2" />
              <ResponsiveActionLabel
                full={t('features.meet.page.bookMeeting')}
                compact={t('features.meet.page.compactBookMeeting')}
              />
            </Button>
          ) : null}

          {hasBooked && !isPast && onCancelBooking ? (
            <Button
              data-action-id="meet.actions.booking.cancel"
              variant="outline"
              onClick={onCancelBooking}
              className={compactActionButtonClassName}
              aria-label={t('features.meet.page.cancelBooking')}
            >
              <UserMinus className="mr-0 h-4 w-4 sm:mr-2" />
              <ResponsiveActionLabel
                full={t('features.meet.page.cancelBooking')}
                compact={t('features.meet.page.compactCancelBooking')}
              />
            </Button>
          ) : null}

          <Button
            data-action-id="meet.actions.calendar.open"
            variant="outline"
            onClick={onNavigateCalendar}
            className={compactActionButtonClassName}
            aria-label={t('features.meet.page.viewInCalendar')}
          >
            <Calendar className="mr-0 h-4 w-4 sm:mr-2" />
            <ResponsiveActionLabel
              full={t('features.meet.page.viewInCalendar')}
              compact={t('features.meet.page.compactViewInCalendar')}
            />
          </Button>

          {isOwner ? (
            <Button
              data-action-id="meet.actions.edit.open"
              variant="outline"
              size="icon"
              aria-label={t('common.actions.edit')}
              onClick={onNavigateEdit}
            >
              <Settings className="h-4 w-4" />
            </Button>
          ) : null}
        </>
      ) : null}

      <ShareButton
        data-action-id="meet.actions.share.open"
        url={`/event/${meetingId}`}
        title={title}
        description={description}
        compactOnMobile
      />
    </ActionBar>
  );
}

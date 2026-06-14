import { BadgeControl } from '@/features/shared/ui/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

interface Booking {
  id: string;
  booker?: {
    id: string;
    name?: string;
    handle?: string;
    avatar?: string;
  };
  notes?: string;
  status: string;
}

interface MeetingParticipantsProps {
  bookings: Booking[];
  count: number;
}

export function MeetingParticipants({ bookings, count }: MeetingParticipantsProps) {
  const { t } = useTranslation();

  if (count === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('features.meet.participants.titleWithCount', { count })}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bookings.map(booking => (
            <div key={booking.id} className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={booking.booker?.avatar} />
                <AvatarFallback>{booking.booker?.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">
                  {booking.booker?.name || t('features.meet.participants.unspecified')}
                </p>
                <p className="text-muted-foreground text-sm">
                  @
                  {booking.booker?.handle ||
                    translateText('generated.inline.0025_unknown_50d8b4a9')}
                </p>
                {booking.notes && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    <span className="font-medium">{t('features.meet.participants.note')}</span>{' '}
                    {booking.notes}
                  </p>
                )}
              </div>
              <BadgeControl variant="outline">{booking.status}</BadgeControl>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

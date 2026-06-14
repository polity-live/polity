import { BadgeControl } from '@/features/shared/ui/status';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Globe, Lock } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { formatMeetingType } from '../logic/meetingFormatters';

interface MeetingHeaderProps {
  title: string;
  isPublic: boolean;
  owner: {
    id: string;
    name?: string;
    avatar?: string;
  };
  meetingType: string;
}

export function MeetingHeader({ title, isPublic, owner, meetingType }: MeetingHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-8 text-center">
      <div className="mb-2 flex items-center justify-center gap-3">
        <h1 className="text-4xl font-bold">{title}</h1>
        {isPublic ? (
          <BadgeControl variant="default">
            <Globe className="mr-1 h-3 w-3" />
            {t('features.meet.page.public')}
          </BadgeControl>
        ) : (
          <BadgeControl variant="secondary">
            <Lock className="mr-1 h-3 w-3" />
            {t('features.meet.page.private')}
          </BadgeControl>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={owner?.avatar} />
          <AvatarFallback>{owner?.name?.[0]?.toUpperCase() || 'O'}</AvatarFallback>
        </Avatar>
        <div className="text-left">
          <p className="text-sm font-medium">
            {t('features.meet.page.hostedBy', {
              name: owner?.name || t('features.meet.participants.unspecified'),
            })}
          </p>
          <p className="text-muted-foreground text-xs">{formatMeetingType(meetingType)}</p>
        </div>
      </div>
    </div>
  );
}

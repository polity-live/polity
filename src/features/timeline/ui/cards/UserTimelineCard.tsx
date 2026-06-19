'use client';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useSubscribeUser } from '@/features/payments/hooks/useSubscribeUser';
import { CONTENT_TYPE_CONFIG } from '../../constants/content-type-config';
import { formatLocation } from '@/features/shared/logic/locationHelpers';

export interface UserTimelineCardProps {
  user: {
    id: string;
    name: string;
    handle?: string;
    bio?: string;
    subtitle?: string;
    avatarUrl?: string;
    location?: string;
    country?: string;
    region?: string;
    post_code?: string;
    city?: string;
    street?: string;
    house_number?: string;
    groupCount?: number;
    amendmentCount?: number;
    hashtags?: { id: string; tag: string }[];
  };
  onFollow?: () => void;
  onMessage?: () => void;
  actions?: React.ReactNode;
  href?: string;
  className?: string;
}
import { UserTimelineCardView } from './UserTimelineCardView';
export function UserTimelineCard({
  user,
  onFollow,
  onMessage,
  actions,
  href,
  className,
}: UserTimelineCardProps) {
  const { t } = useTranslation();
  const subscription = useSubscribeUser(user.id);
  const amendmentStyle = CONTENT_TYPE_CONFIG.amendment;
  const location = user.location || formatLocation(user);

  const initials = user.name
    ? user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';
  return (
    <UserTimelineCardView
      user={user}
      onFollow={onFollow}
      onMessage={onMessage}
      actions={actions}
      href={href}
      className={className}
      t={t}
      subscription={subscription}
      amendmentStyle={amendmentStyle}
      location={location}
      initials={initials}
    />
  );
}

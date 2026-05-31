import { type SearchUser } from '../types/search.types';
import { UserTimelineCard } from '@/features/timeline/ui/cards/UserTimelineCard';

interface UserSearchCardProps {
  user: Partial<SearchUser> & {
    id: string;
    first_name?: string;
    last_name?: string;
    handle?: string;
    avatar?: string | null;
    bio?: string | null;
    location?: string | null;
  };
  index?: number;
  actions?: React.ReactNode;
}

export function UserSearchCard({ user, actions }: UserSearchCardProps) {
  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    user.handle ||
    'Unknown User';

  return (
    <UserTimelineCard
      user={{
        id: user.id,
        name: displayName,
        handle: user.handle ?? undefined,
        avatarUrl: user.avatar ?? undefined,
        bio: user.bio ?? undefined,
        location: user.location ?? undefined,
      }}
      actions={actions}
    />
  );
}

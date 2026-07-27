import { Link } from '@tanstack/react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import type { ParticipationUserLike } from '@/features/shared/types/participation';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export interface UserTableCellProps {
  user?: ParticipationUserLike | null;
  displayName?: string | null;
  fallbackLabel?: string;
}

function getDisplayName(user?: ParticipationUserLike | null, displayName?: string | null) {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) {
    return trimmedDisplayName;
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  return user?.handle || user?.email || null;
}

function getInitials(name: string) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'U';
}

export function UserTableCell({ user, displayName, fallbackLabel }: UserTableCellProps) {
  const { t } = useTranslation();
  const resolvedDisplayName =
    getDisplayName(user, displayName) || fallbackLabel || t('common.unknownUser');
  const linkUserId = user?.id || null;

  if (linkUserId) {
    return (
      <Link
        to="/user/$id"
        params={{ id: linkUserId }}
        className="group flex items-center gap-3 text-left"
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={user?.avatar || undefined} alt={resolvedDisplayName} />
          <AvatarFallback>{getInitials(resolvedDisplayName)}</AvatarFallback>
        </Avatar>
        <div className="group-hover:underline">
          <div className="font-medium">{resolvedDisplayName}</div>
          {user?.handle ? (
            <div className="text-muted-foreground text-sm">@{user.handle}</div>
          ) : null}
        </div>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-left">
      <Avatar className="h-10 w-10">
        <AvatarImage src={user?.avatar || undefined} alt={resolvedDisplayName} />
        <AvatarFallback>{getInitials(resolvedDisplayName)}</AvatarFallback>
      </Avatar>
      <div>
        <div className="font-medium">{resolvedDisplayName}</div>
        {user?.handle ? <div className="text-muted-foreground text-sm">@{user.handle}</div> : null}
      </div>
    </div>
  );
}

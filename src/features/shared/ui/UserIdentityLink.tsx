import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { User } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { cn } from '@/features/shared/utils/utils';

interface UserIdentityLinkProps {
  avatarClassName?: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
  handle?: string | null;
  handleClassName?: string;
  name: ReactNode;
  nameClassName?: string;
  secondary?: ReactNode;
  showHandle?: boolean;
  textContainerClassName?: string;
  userId?: string | null;
}

function getInitials(label?: string) {
  return label
    ?.split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function UserIdentityLink({
  avatarClassName,
  avatarUrl,
  className,
  fallbackClassName,
  fallbackLabel,
  handle,
  handleClassName,
  name,
  nameClassName,
  secondary,
  showHandle,
  textContainerClassName,
  userId,
}: UserIdentityLinkProps) {
  const initials = getInitials(fallbackLabel);
  const content = (
    <>
      <Avatar className={cn('rounded-md', avatarClassName)}>
        <AvatarImage
          src={avatarUrl ?? undefined}
          alt={fallbackLabel ?? ''}
          className="object-cover"
        />
        <AvatarFallback className={cn('rounded-md', fallbackClassName)}>
          {initials || <User className="h-3 w-3" />}
        </AvatarFallback>
      </Avatar>
      <span className={cn('min-w-0', textContainerClassName)}>
        <span className={nameClassName}>{name}</span>
        {showHandle && handle ? <span className={handleClassName}>@{handle}</span> : null}
        {secondary}
      </span>
    </>
  );
  const identityClassName = cn(
    'inline-flex min-w-0 items-center gap-2 rounded-md',
    userId &&
      'hover:underline focus-visible:ring-ring/45 focus-visible:ring-2 focus-visible:outline-none',
    className
  );

  if (!userId) {
    return <span className={identityClassName}>{content}</span>;
  }

  return (
    <Link to="/user/$id" params={{ id: userId }} className={identityClassName}>
      {content}
    </Link>
  );
}

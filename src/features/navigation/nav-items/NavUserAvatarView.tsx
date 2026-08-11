import { UserMenu } from '@/features/navigation/UserMenu.tsx';
import type { NavigationView } from '@/features/navigation/types/navigation.types.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import { Button } from '@/features/shared/ui/ui/button';

interface NavUserAvatarViewProps {
  navigationView: NavigationView;
  isMobile: boolean;
  className?: string;
  displayAvatar?: string | null;
  displayName: string;
  isDropdownOpen: boolean;
  user: Parameters<typeof UserMenu>[0]['user'];
  userInitials: string;
  onAsButtonClick: () => void;
  onDropdownOpenChange: (open: boolean) => void;
  onNameClick: () => void;
}

export function NavUserAvatarView({
  navigationView,
  className,
  isMobile,
  displayAvatar,
  displayName,
  isDropdownOpen,
  user,
  userInitials,
  onAsButtonClick,
  onDropdownOpenChange,
  onNameClick,
}: NavUserAvatarViewProps) {
  if (navigationView === 'asButton') {
    return (
      <Button
        type="button"
        variant="ghost"
        data-tutorial-anchor="primary-avatar"
        className={cn(
          'flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80',
          className
        )}
        onClick={onAsButtonClick}
        data-action-id="navigation.avatar.overlay.open"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={displayAvatar || undefined} alt={displayName} />
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm font-medium">{displayName}</span>
      </Button>
    );
  }

  if (navigationView === 'asButtonList') {
    return (
      <div
        data-tutorial-anchor="primary-avatar"
        className={cn('flex items-center justify-center', className)}
      >
        <UserMenu isMobile={isMobile} user={user} />
      </div>
    );
  }

  if (navigationView === 'asLabeledButtonList' && isMobile) {
    return (
      <div
        data-tutorial-anchor="primary-avatar"
        className={cn('flex items-center justify-center', className)}
      >
        <UserMenu isMobile={isMobile} user={user} />
      </div>
    );
  }

  return (
    <div
      data-tutorial-anchor="primary-avatar"
      className={cn('flex w-full items-center gap-3 px-3 py-2', className)}
    >
      <UserMenu
        isMobile={isMobile}
        open={isDropdownOpen}
        onOpenChange={onDropdownOpenChange}
        user={user}
      />
      <button
        type="button"
        className="cursor-pointer truncate text-sm font-medium"
        onClick={onNameClick}
        data-action-id="navigation.avatar.name.open"
      >
        {displayName}
      </button>
    </div>
  );
}

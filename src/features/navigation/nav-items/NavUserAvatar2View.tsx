import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import type { NavigationView } from '@/features/navigation/types/navigation.types.tsx';

interface NavUserAvatar2ViewProps {
  navigationView: NavigationView;
  isMobile: boolean;
  className?: string;
  avatarUrl: string;
  hoveredItem: string | null;
  popoverId: string;
  userName: string;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

export function NavUserAvatar2View({
  navigationView,
  isMobile,
  className,
  avatarUrl,
  hoveredItem,
  popoverId,
  userName,
  onClick,
  onHoverStart,
  onHoverEnd,
}: NavUserAvatar2ViewProps) {
  if (navigationView === 'asButton') {
    return (
      <Button
        variant="ghost"
        className={cn(
          'hover:bg-accent flex h-24 w-fit items-center justify-center gap-4',
          className
        )}
        onClick={onClick}
        data-action-id="navigation.avatar2.overlay.open"
      >
        <Avatar className="h-12 w-12">
          <AvatarImage src={avatarUrl} alt={userName} />
          <AvatarFallback>{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-lg font-medium">{userName}</span>
      </Button>
    );
  }

  if (navigationView === 'asButtonList') {
    return (
      <Popover open={hoveredItem === popoverId}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size={isMobile ? 'icon' : undefined}
            className={cn(
              isMobile
                ? 'hover:bg-accent h-12 w-12 flex-shrink-0'
                : 'flex h-12 w-full items-center justify-center',
              className
            )}
            onClick={onClick}
            data-action-id="navigation.avatar2.list.open"
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            {...(isMobile && {
              onTouchStart: onHoverStart,
              onTouchEnd: onHoverEnd,
            })}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl} alt={userName} />
              <AvatarFallback>{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </PopoverTrigger>
        <PopoverContent side={isMobile ? 'top' : 'right'} className="w-auto p-2" sideOffset={8}>
          <span className="text-sm font-medium">{userName}</span>
        </PopoverContent>
      </Popover>
    );
  }

  if (navigationView === 'asLabeledButtonList' && isMobile) {
    return (
      <Popover open={hoveredItem === popoverId}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('hover:bg-accent h-12 w-12 flex-shrink-0', className)}
            onClick={onClick}
            data-action-id="navigation.avatar2.mobile-labeled.open"
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            onTouchStart={onHoverStart}
            onTouchEnd={onHoverEnd}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl} alt={userName} />
              <AvatarFallback>{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-auto p-2" sideOffset={8}>
          <span className="text-sm font-medium">{userName}</span>
        </PopoverContent>
      </Popover>
    );
  }

  if (navigationView === 'asLabeledButtonList' && !isMobile) {
    return (
      <div className="px-4">
        <Button
          variant="ghost"
          className={cn('mt-2 h-12 w-full justify-start gap-3 pl-3', className)}
          onClick={onClick}
          data-action-id="navigation.avatar2.desktop-labeled.open"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} alt={userName} />
            <AvatarFallback>{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span>{userName}</span>
        </Button>
      </div>
    );
  }

  return null;
}

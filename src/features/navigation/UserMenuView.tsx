import { featureThemeClassName } from '@/features/shared/theme';
import type { RefObject } from 'react';
import { Link } from '@tanstack/react-router';
import { LogOut, Search, Settings, User, X } from 'lucide-react';

import { FormControlInput } from '@/features/shared/ui/form';
import { ScrollableAlertDialogContent } from '@/features/shared/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { cn } from '@/features/shared/utils/utils.ts';

export interface UserMenuGroup {
  id: string;
  name?: string | null;
  image_url?: string | null;
}

interface UserMenuViewLabels {
  profile: string;
  settings: string;
  groups: string;
  searchGroupsPlaceholder: string;
  clear: string;
  logout: string;
  logoutConfirm: string;
  cancel: string;
}

interface UserMenuViewProps {
  className?: string;
  isMobile?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  displayName: string;
  displayEmail: string;
  displayAvatar?: string;
  userInitials: string;
  profileHref: string;
  settingsHref: string;
  groups: UserMenuGroup[];
  showGroupSearch: boolean;
  groupSearchQuery: string;
  groupSearchInputRef: RefObject<HTMLInputElement | null>;
  labels: UserMenuViewLabels;
  logoutDialogOpen: boolean;
  onLogoutDialogOpenChange: (open: boolean) => void;
  onGroupSearchChange: (query: string) => void;
  onClearGroupSearch: () => void;
  onLogout: () => void | Promise<void>;
}

export function UserMenuView({
  className,
  isMobile,
  open,
  onOpenChange,
  displayName,
  displayEmail,
  displayAvatar,
  userInitials,
  profileHref,
  settingsHref,
  groups,
  showGroupSearch,
  groupSearchQuery,
  groupSearchInputRef,
  labels,
  logoutDialogOpen,
  onLogoutDialogOpenChange,
  onGroupSearchChange,
  onClearGroupSearch,
  onLogout,
}: UserMenuViewProps) {
  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            data-user-menu-trigger
            variant="ghost"
            className={cn(
              'hover:bg-accent h-10 w-10 rounded-full p-0',
              isMobile && 'h-12 w-12',
              className
            )}
          >
            <Avatar className={cn('h-8 w-8', isMobile && 'h-10 w-10')}>
              <AvatarImage src={displayAvatar} alt={displayName} />
              <AvatarFallback className="text-xs font-medium">{userInitials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="z-50 max-h-[80vh] w-56 overflow-y-auto">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm leading-none font-medium">{displayName}</p>
              <p className="text-muted-foreground text-xs leading-none">{displayEmail}</p>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link to={profileHref} className="flex w-full items-center">
              <User className="mr-2 h-4 w-4" />
              {labels.profile}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to={settingsHref} className="flex w-full items-center">
              <Settings className="mr-2 h-4 w-4" />
              {labels.settings}
            </Link>
          </DropdownMenuItem>

          {groups.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground px-2 py-1.5 text-xs font-semibold">
                {labels.groups}
              </DropdownMenuLabel>
              {showGroupSearch ? (
                <div className="px-2 pb-1">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                    <FormControlInput
                      ref={groupSearchInputRef}
                      autoFocus
                      value={groupSearchQuery}
                      onChange={event => onGroupSearchChange(event.target.value)}
                      onKeyDown={event => event.stopPropagation()}
                      onPointerDown={event => event.stopPropagation()}
                      placeholder={labels.searchGroupsPlaceholder}
                      className="h-8 pr-8 pl-8 text-xs"
                    />
                    {groupSearchQuery.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClearGroupSearch}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
                        aria-label={labels.clear}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {groups.map(group => (
                <DropdownMenuItem key={group.id} asChild>
                  <Link
                    to="/group/$id"
                    params={{ id: group.id }}
                    className="flex w-full items-center gap-2"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage
                        src={group.image_url ?? undefined}
                        alt={group.name ?? undefined}
                      />
                      <AvatarFallback
                        className={featureThemeClassName('agendaAccreditationSectionThemedText')}
                      >
                        {group.name?.[0]?.toUpperCase() || 'G'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm">{group.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => onLogoutDialogOpenChange(true)}
            className={featureThemeClassName('navigationUserMenuDangerText')}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {labels.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={logoutDialogOpen} onOpenChange={onLogoutDialogOpenChange}>
        <ScrollableAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.logout}</AlertDialogTitle>
            <AlertDialogDescription>{labels.logoutConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={onLogout}>{labels.logout}</AlertDialogAction>
          </AlertDialogFooter>
        </ScrollableAlertDialogContent>
      </AlertDialog>
    </>
  );
}

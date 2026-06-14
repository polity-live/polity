'use client';

import { FormControlInput } from '@/features/shared/ui/form';
import { ScrollableAlertDialogContent } from '@/features/shared/ui/dialog';
import { useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { LogOut, Search, Settings, User, X } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider.tsx';
import { useGroupState } from '@/zero/groups/useGroupState.ts';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { cn } from '@/features/shared/utils/utils.ts';
import type { UserProfile } from '@/features/users/types/user.types.ts';

interface UserMenuProps {
  className?: string;
  isMobile?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  user?: UserProfile | null;
}

export function UserMenu({
  className,
  isMobile,
  open,
  onOpenChange,
  user: userData,
}: UserMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser, signOut } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Query user's group memberships with nested group data
  const { currentUserMembershipsWithGroups } = useGroupState({
    includeCurrentUserMembershipsWithGroups: true,
  });
  const membershipsData = { groupMemberships: currentUserMembershipsWithGroups };

  // Filter active memberships (member or admin)
  const activeGroups = useMemo(() => {
    const memberships = membershipsData?.groupMemberships || [];
    return memberships
      .filter(
        m => m.group && (m.status === 'active' || m.status === 'admin' || m.role?.name === 'admin')
      )
      .map(m => m.group)
      .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
  }, [membershipsData]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = groupSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return activeGroups;
    }

    return activeGroups.filter(group => group?.name?.toLowerCase().includes(normalizedQuery));
  }, [activeGroups, groupSearchQuery]);

  const showGroupSearch = activeGroups.length > 5;

  if (!authUser) return null;

  // Prefer user data, fallback to auth data
  const displayName =
    [userData?.first_name, userData?.last_name].filter(Boolean).join(' ') ||
    authUser.email?.split('@')[0] ||
    'User';
  const displayAvatar = userData?.avatar ?? undefined;
  const displayEmail = authUser.email || '';
  const profileHref = `/user/${authUser.id}`;
  const settingsHref = `/user/${authUser.id}/settings`;
  const signInHref = '/auth/sign-in';

  const handleLogout = async () => {
    try {
      setShowLogoutDialog(false);
      await navigate({ to: signInHref, replace: true });
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const userInitials = displayName
    ? displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : displayEmail.substring(0, 2).toUpperCase();

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
              {t('navigation.userMenu.profile')}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to={settingsHref} className="flex w-full items-center">
              <Settings className="mr-2 h-4 w-4" />
              {t('navigation.userMenu.settings')}
            </Link>
          </DropdownMenuItem>

          {activeGroups.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground px-2 py-1.5 text-xs font-semibold">
                {t('common.labels.groups')}
              </DropdownMenuLabel>
              {showGroupSearch && (
                <div className="px-2 pb-1">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                    <FormControlInput
                      ref={inputRef}
                      autoFocus
                      value={groupSearchQuery}
                      onChange={event => setGroupSearchQuery(event.target.value)}
                      onKeyDown={e => e.stopPropagation()}
                      onPointerDown={e => e.stopPropagation()}
                      placeholder={t('navigation.userMenu.searchGroupsPlaceholder')}
                      className="h-8 pr-8 pl-8 text-xs"
                    />
                    {groupSearchQuery.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setGroupSearchQuery('');
                          inputRef.current?.focus();
                        }}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex h-4 w-4 -translate-y-1/2 items-center justify-center"
                        aria-label={t('common.actions.clear')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {filteredGroups.map(
                group =>
                  group && (
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
                          <AvatarFallback className="text-[10px]">
                            {group.name?.[0]?.toUpperCase() || 'G'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm">{group.name}</span>
                      </Link>
                    </DropdownMenuItem>
                  )
              )}
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setShowLogoutDialog(true)}
            className="text-red-600 focus:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('auth.logout.button')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <ScrollableAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('auth.logout.button')}</AlertDialogTitle>
            <AlertDialogDescription>{t('auth.logout.confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>{t('auth.logout.button')}</AlertDialogAction>
          </AlertDialogFooter>
        </ScrollableAlertDialogContent>
      </AlertDialog>
    </>
  );
}

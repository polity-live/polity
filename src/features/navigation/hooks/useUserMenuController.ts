import { useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import type { UserProfile } from '@/features/users/types/user.types.ts';
import { useAuth } from '@/providers/auth-provider.tsx';
import { useGroupState } from '@/zero/groups/useGroupState.ts';
import type { UserMenuGroup } from '../UserMenuView';

interface UseUserMenuControllerOptions {
  user?: UserProfile | null;
}

export function useUserMenuController({ user: userData }: UseUserMenuControllerOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser, signOut } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { currentUserMembershipsWithGroups } = useGroupState({
    includeCurrentUserMembershipsWithGroups: true,
  });
  const membershipsData = { groupMemberships: currentUserMembershipsWithGroups };

  const activeGroups = useMemo<UserMenuGroup[]>(() => {
    const memberships = membershipsData?.groupMemberships || [];
    return memberships
      .flatMap(m => {
        if (
          !m.group ||
          !(m.status === 'active' || m.status === 'admin' || m.role?.name === 'admin')
        ) {
          return [];
        }

        return [
          {
            id: m.group.id,
            name: m.group.name,
            image_url: m.group.image_url,
          },
        ];
      })
      .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
  }, [membershipsData]);

  const filteredGroups = useMemo<UserMenuGroup[]>(() => {
    const normalizedQuery = groupSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return activeGroups;
    }

    return activeGroups.filter(group => group.name?.toLowerCase().includes(normalizedQuery));
  }, [activeGroups, groupSearchQuery]);

  if (!authUser) return null;

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
        .map((namePart: string) => namePart[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : displayEmail.substring(0, 2).toUpperCase();

  return {
    displayName,
    displayEmail,
    displayAvatar,
    userInitials,
    profileHref,
    settingsHref,
    groups: filteredGroups,
    showGroupSearch: activeGroups.length > 5,
    groupSearchQuery,
    groupSearchInputRef: inputRef,
    labels: {
      profile: t('navigation.userMenu.profile'),
      settings: t('navigation.userMenu.settings'),
      groups: t('common.labels.groups'),
      searchGroupsPlaceholder: t('navigation.userMenu.searchGroupsPlaceholder'),
      clear: t('common.actions.clear'),
      logout: t('auth.logout.button'),
      logoutConfirm: t('auth.logout.confirm'),
      cancel: t('common.actions.cancel'),
    },
    logoutDialogOpen: showLogoutDialog,
    onLogoutDialogOpenChange: setShowLogoutDialog,
    onGroupSearchChange: setGroupSearchQuery,
    onClearGroupSearch: () => {
      setGroupSearchQuery('');
      inputRef.current?.focus();
    },
    onLogout: handleLogout,
  };
}

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import type { UserProfile } from '@/features/users/types/user.types.ts';
import { useAuth } from '@/providers/auth-provider.tsx';
import { useCurrentUserNavigationEntities } from './useCurrentUserNavigationEntities';

export type UserMenuUser = Pick<UserProfile, 'first_name' | 'last_name' | 'avatar'>;

interface UseUserMenuControllerOptions {
  user?: UserMenuUser | null;
  navigationEnabled?: boolean;
}

export function useUserMenuController({
  user: userData,
  navigationEnabled = true,
}: UseUserMenuControllerOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser, signOut } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [amendmentSearchQuery, setAmendmentSearchQuery] = useState('');
  const groupSearchInputRef = useRef<HTMLInputElement>(null);
  const eventSearchInputRef = useRef<HTMLInputElement>(null);
  const amendmentSearchInputRef = useRef<HTMLInputElement>(null);
  const {
    groups: activeGroups,
    events: activeEvents,
    amendments: openAmendments,
    isLoading: navigationEntitiesLoading,
  } = useCurrentUserNavigationEntities(authUser?.id, navigationEnabled);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = groupSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return activeGroups;
    }

    return activeGroups.filter(group => group.name?.toLowerCase().includes(normalizedQuery));
  }, [activeGroups, groupSearchQuery]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = eventSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return activeEvents;
    }

    return activeEvents.filter(event => event.title?.toLowerCase().includes(normalizedQuery));
  }, [activeEvents, eventSearchQuery]);

  const filteredAmendments = useMemo(() => {
    const normalizedQuery = amendmentSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return openAmendments;
    }

    return openAmendments.filter(amendment =>
      [
        amendment.title,
        amendment.code,
        amendment.targetGroupName,
        amendment.groupName,
        amendment.eventTitle,
      ]
        .filter(Boolean)
        .some(value => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [openAmendments, amendmentSearchQuery]);

  if (!authUser) return null;

  const displayName =
    [userData?.first_name, userData?.last_name].filter(Boolean).join(' ') ||
    authUser.email?.split('@')[0] ||
    'User';
  const displayAvatar = userData?.avatar ?? undefined;
  const displayEmail = authUser.email || '';
  const profileHref = `/user/${authUser.id}`;
  const settingsHref = `/user/${authUser.id}/settings`;
  const docsHref = '/docs';
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
    docsHref,
    navigationEntitiesLoading,
    groups: filteredGroups,
    events: filteredEvents,
    amendments: filteredAmendments,
    showGroupSearch: activeGroups.length > 5,
    showEventSearch: activeEvents.length > 5,
    showAmendmentSearch: openAmendments.length > 5,
    groupSearchQuery,
    eventSearchQuery,
    amendmentSearchQuery,
    groupSearchInputRef,
    eventSearchInputRef,
    amendmentSearchInputRef,
    labels: {
      profile: t('navigation.userMenu.profile'),
      settings: t('navigation.userMenu.settings'),
      docs: t('navigation.userMenu.docs'),
      groups: t('common.labels.groups'),
      events: t('navigation.userMenu.events'),
      amendments: t('navigation.userMenu.amendments'),
      eventFallback: t('navigation.userMenu.eventFallback'),
      amendmentFallback: t('navigation.userMenu.amendmentFallback'),
      searchGroupsPlaceholder: t('navigation.userMenu.searchGroupsPlaceholder'),
      searchEventsPlaceholder: t('navigation.userMenu.searchEventsPlaceholder'),
      searchAmendmentsPlaceholder: t('navigation.userMenu.searchAmendmentsPlaceholder'),
      clear: t('common.actions.clear'),
      loading: t('common.loading.general'),
      logout: t('auth.logout.button'),
      logoutConfirm: t('auth.logout.confirm'),
      cancel: t('common.actions.cancel'),
    },
    logoutDialogOpen: showLogoutDialog,
    onLogoutDialogOpenChange: setShowLogoutDialog,
    onGroupSearchChange: setGroupSearchQuery,
    onEventSearchChange: setEventSearchQuery,
    onAmendmentSearchChange: setAmendmentSearchQuery,
    onClearGroupSearch: () => {
      setGroupSearchQuery('');
      groupSearchInputRef.current?.focus();
    },
    onClearEventSearch: () => {
      setEventSearchQuery('');
      eventSearchInputRef.current?.focus();
    },
    onClearAmendmentSearch: () => {
      setAmendmentSearchQuery('');
      amendmentSearchInputRef.current?.focus();
    },
    onLogout: handleLogout,
  };
}

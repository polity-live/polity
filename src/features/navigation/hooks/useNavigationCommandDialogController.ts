import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import {
  useCommandDialogShortcut,
  useNavigationKeyboard,
} from '@/features/navigation/nav-keyboard/use-navigation-keyboard.tsx';
import { navItemsAuthenticated } from '@/features/navigation/nav-items/nav-items-authenticated.tsx';
import { useNavigationStore } from '@/features/navigation/state/navigation.store.tsx';
import type { NavigationItem } from '@/features/navigation/types/navigation.types.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { useAuth } from '@/providers/auth-provider.tsx';
import { useCurrentUserNavigationEntities } from './useCurrentUserNavigationEntities';
import type { UserMenuEvent, UserMenuGroup } from '../logic/userMenuItems';

interface UseNavigationCommandDialogControllerProps {
  primaryNavItems: NavigationItem[];
  secondaryNavItems: NavigationItem[] | null;
}

export function useNavigationCommandDialogController({
  primaryNavItems,
  secondaryNavItems,
}: UseNavigationCommandDialogControllerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { setNavigationType } = useNavigationStore();
  const { groups: groupItems, events: eventItems } = useCurrentUserNavigationEntities(user?.id);

  useCommandDialogShortcut(setOpen, open);

  const allNavItems = [...primaryNavItems, ...(secondaryNavItems || [])];

  const selectNavigationItem = (item: NavigationItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      navigate({ to: item.href });
    } else {
      const route = item.id === 'home' ? '/' : `/${item.id}`;
      navigate({ to: route });
    }

    setOpen(false);
  };

  const selectGroupItem = (group: UserMenuGroup) => {
    navigate({ to: '/group/$id', params: { id: group.id } });
    setOpen(false);
  };

  const selectEventItem = (event: UserMenuEvent) => {
    navigate({ to: '/event/$id', params: { id: event.id } });
    setOpen(false);
  };

  useNavigationKeyboard({
    isActive: true,
    onNavigate: (navId: string) => {
      const navItem = allNavItems.find(item => item.id === navId);
      if (!navItem) return;

      selectNavigationItem(navItem);

      const inPrimary = primaryNavItems.some(primaryNavItem => primaryNavItem.id === navItem.id);
      const inSecondary = secondaryNavItems
        ? secondaryNavItems.some(secondaryNavItem => secondaryNavItem.id === navItem.id)
        : false;

      if (inPrimary && !inSecondary) {
        setNavigationType('primary');
      } else if (inSecondary && !inPrimary) {
        setNavigationType('secondary');
      }
    },
    onThemeToggle: () => setOpen(false),
    onKeyboardShortcutsOpen: () => setOpen(false),
    onClose: () => setOpen(false),
    items: allNavItems,
  });

  return {
    open,
    setOpen,
    copy: {
      placeholder: t('navigation.commandDialog.placeholder'),
      noResults: t('navigation.commandDialog.noResults'),
      primaryNavigation: t('navigation.commandDialog.groups.primaryNavigation'),
      userNavigation: t('navigation.commandDialog.groups.userNavigation'),
      groups: t('common.labels.groups'),
      events: t('navigation.userMenu.events'),
      eventFallback: t('navigation.userMenu.eventFallback'),
    },
    groupItems,
    eventItems,
    userNavItems: user?.id
      ? navItemsAuthenticated(navigate).getUserSecondaryNavItems(user.id, true)
      : [],
    onSelectPrimaryItem: selectNavigationItem,
    onSelectUserItem: selectNavigationItem,
    onSelectGroupItem: selectGroupItem,
    onSelectEventItem: selectEventItem,
  };
}

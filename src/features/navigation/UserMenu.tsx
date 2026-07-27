'use client';

import { useEffect, useState } from 'react';
import {
  APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION,
  reportAppTutorialAction,
} from '@/features/app-tutorial/events';
import { useUserMenuController, type UserMenuUser } from './hooks/useUserMenuController';
import { UserMenuView } from './UserMenuView';

interface UserMenuProps {
  className?: string;
  isMobile?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  user?: UserMenuUser | null;
}

export function UserMenu({
  className,
  isMobile,
  open,
  onOpenChange,
  user: userData,
}: UserMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const resolvedOpen = open ?? internalOpen;
  const handleOpenChange = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  useEffect(() => {
    if (resolvedOpen) {
      reportAppTutorialAction({
        type: 'action',
        event: APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION,
      });
    }
  }, [resolvedOpen]);
  const viewProps = useUserMenuController({
    user: userData,
    navigationEnabled: resolvedOpen,
  });

  if (!viewProps) return null;

  return (
    <UserMenuView
      className={className}
      isMobile={isMobile}
      open={resolvedOpen}
      onOpenChange={handleOpenChange}
      {...viewProps}
    />
  );
}

'use client';

import type { UserProfile } from '@/features/users/types/user.types.ts';
import { useUserMenuController } from './hooks/useUserMenuController';
import { UserMenuView } from './UserMenuView';

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
  const viewProps = useUserMenuController({ user: userData });

  if (!viewProps) return null;

  return (
    <UserMenuView
      className={className}
      isMobile={isMobile}
      open={open}
      onOpenChange={onOpenChange}
      {...viewProps}
    />
  );
}

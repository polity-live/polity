import { useRef, useState } from 'react';

import { useNavigate } from '@tanstack/react-router';

import type { NavigationView } from '@/features/navigation/types/navigation.types.tsx';
import { useUserData } from '@/features/users/hooks/useUserData.ts';

interface UseNavUserAvatarControllerProps {
  navigationView: NavigationView;
  authUser: {
    id: string;
    email?: string | null;
  };
}

export function useNavUserAvatarController({
  navigationView,
  authUser,
}: UseNavUserAvatarControllerProps) {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useUserData(authUser.id);

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    authUser.email?.split('@')[0] ||
    'User';
  const displayAvatar = user?.avatar;

  const userInitials = displayName
    ? displayName
        .split(' ')
        .map((name: string) => name[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : (authUser.email?.substring(0, 2) || 'U').toUpperCase();

  const handleAsButtonClick = () => {
    if (navigationView === 'asButton' && authUser.id) {
      navigate({ to: `/user/${authUser.id}` });
    }
  };

  const handleNameClick = () => {
    setIsDropdownOpen(open => !open);
  };

  const handleDropdownOpenChange = (open: boolean) => {
    if (!open && closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setIsDropdownOpen(open);
  };

  return {
    displayAvatar,
    displayName,
    isDropdownOpen,
    user,
    userInitials,
    onAsButtonClick: handleAsButtonClick,
    onDropdownOpenChange: handleDropdownOpenChange,
    onNameClick: handleNameClick,
  };
}

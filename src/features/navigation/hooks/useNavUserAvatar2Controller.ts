import { useState } from 'react';

import { useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/providers/auth-provider.tsx';

export function useNavUserAvatar2Controller(isMobile: boolean) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const popoverId = isMobile ? 'user-avatar-mobile' : 'user-avatar';

  if (!authUser) {
    return null;
  }

  return {
    avatarUrl: '/placeholder-user.jpg',
    hoveredItem,
    popoverId,
    userName: 'John Doe',
    onClick: () => navigate({ to: `/user/${authUser.id}` }),
    onHoverStart: () => setHoveredItem(popoverId),
    onHoverEnd: () => setHoveredItem(null),
  };
}

import { useNavUserAvatarController } from '@/features/navigation/hooks/useNavUserAvatarController';
import type { NavigationView } from '@/features/navigation/types/navigation.types.tsx';
import { NavUserAvatarView } from './NavUserAvatarView';

interface ConnectedNavUserAvatarProps {
  navigationView: NavigationView;
  isMobile: boolean;
  className?: string;
  authUser: {
    id: string;
    email?: string | null;
  };
}

export default function ConnectedNavUserAvatar({
  authUser,
  ...viewProps
}: ConnectedNavUserAvatarProps) {
  const controller = useNavUserAvatarController({
    navigationView: viewProps.navigationView,
    authUser,
  });

  return <NavUserAvatarView {...viewProps} {...controller} />;
}

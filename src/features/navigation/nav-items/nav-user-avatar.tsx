import { useNavUserAvatarController } from '@/features/navigation/hooks/useNavUserAvatarController';
import type { NavigationView } from '@/features/navigation/types/navigation.types.tsx';
import { NavUserAvatarView } from './NavUserAvatarView';

export function NavUserAvatar(props: {
  navigationView: NavigationView;
  isMobile: boolean;
  className?: string;
}) {
  const controller = useNavUserAvatarController({ navigationView: props.navigationView });

  if (!controller) {
    return null;
  }

  return <NavUserAvatarView {...props} {...controller} />;
}

import { useNavUserAvatarController } from '@/features/navigation/hooks/useNavUserAvatarController';
import type { NavigationView } from '@/features/navigation/types/navigation.types.tsx';
import { useAuth } from '@/providers/auth-provider.tsx';
import { useZeroReady } from '@/providers/zero-provider.tsx';
import { NavUserAvatarView } from './NavUserAvatarView';

export function NavUserAvatar(props: {
  navigationView: NavigationView;
  isMobile: boolean;
  className?: string;
}) {
  const { user: authUser } = useAuth();
  const zeroReady = useZeroReady();

  if (!authUser || !zeroReady) {
    return null;
  }

  return <NavUserAvatarWithZero {...props} authUser={authUser} />;
}

function NavUserAvatarWithZero({
  authUser,
  ...viewProps
}: {
  navigationView: NavigationView;
  isMobile: boolean;
  className?: string;
} & {
  authUser: {
    id: string;
    email?: string | null;
  };
}) {
  const controller = useNavUserAvatarController({
    navigationView: viewProps.navigationView,
    authUser,
  });

  return <NavUserAvatarView {...viewProps} {...controller} />;
}

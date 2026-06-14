import { useNavUserAvatar2Controller } from '@/features/navigation/hooks/useNavUserAvatar2Controller';
import type { NavigationView } from '@/features/navigation/types/navigation.types.tsx';
import { NavUserAvatar2View } from './NavUserAvatar2View';

export function NavUserAvatar({
  navigationView,
  className,
  isMobile,
}: {
  navigationView: NavigationView;
  isMobile: boolean;
  className?: string;
}) {
  const controller = useNavUserAvatar2Controller(isMobile);

  if (!controller) {
    return null;
  }

  return (
    <NavUserAvatar2View
      navigationView={navigationView}
      isMobile={isMobile}
      className={className}
      {...controller}
    />
  );
}

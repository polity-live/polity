import { lazy, Suspense } from 'react';
import type { NavigationView } from '@/features/navigation/types/navigation.types.tsx';
import { useAuth } from '@/providers/auth-provider.tsx';
import { useZeroReady } from '@/providers/zero-ready-context.ts';

const ConnectedNavUserAvatar = lazy(() => import('./nav-user-avatar-connected'));

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

  return (
    <Suspense fallback={null}>
      <ConnectedNavUserAvatar {...props} authUser={authUser} />
    </Suspense>
  );
}

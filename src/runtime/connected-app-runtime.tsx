import type { ReactNode } from 'react';
import { OnlineUsersProvider } from '@/presence';
import { ZeroAppProvider } from '@/providers/zero-provider';

export default function ConnectedAppRuntime({ children }: { children: ReactNode }) {
  return (
    <OnlineUsersProvider>
      <ZeroAppProvider>{children}</ZeroAppProvider>
    </OnlineUsersProvider>
  );
}

import { lazy, Suspense, createContext, useContext, useMemo } from 'react';
import { schema } from '@/zero/schema';
import { mutators } from '@/zero/mutators';
import { useAuth } from './auth-provider';

// Use React lazy to defer loading the ZeroProvider (client-side only)
const ZeroProvider = lazy(() =>
  import('@rocicorp/zero/react').then(mod => ({
    default: mod.ZeroProvider,
  }))
);

const ZeroReadyContext = createContext(false);

function getRequiredEnvVar(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is not defined`);
  }

  return value;
}

export function useZeroReady() {
  return useContext(ZeroReadyContext);
}

export function ZeroAppProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const cacheURL = getRequiredEnvVar(import.meta.env.VITE_ZERO_CACHE_URL, 'VITE_ZERO_CACHE_URL');
  const appURL = getRequiredEnvVar(import.meta.env.VITE_APP_URL, 'VITE_APP_URL');

  const zeroContext = useMemo(
    () =>
      session
        ? { userID: session.user.id, email: session.user.email ?? '' }
        : { userID: 'anon', email: '' },
    [session?.user?.id, session?.user?.email]
  );

  return (
    <Suspense
      fallback={<ZeroReadyContext.Provider value={false}>{children}</ZeroReadyContext.Provider>}
    >
      <ZeroReadyContext.Provider value={true}>
        <ZeroProvider
          userID={zeroContext.userID}
          context={zeroContext}
          cacheURL={cacheURL}
          queryURL={`${appURL}/api/query`}
          mutateURL={`${appURL}/api/mutate`}
          auth={session?.access_token ?? undefined}
          schema={schema}
          mutators={mutators}
        >
          {children}
        </ZeroProvider>
      </ZeroReadyContext.Provider>
    </Suspense>
  );
}

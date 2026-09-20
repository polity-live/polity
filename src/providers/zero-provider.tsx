import { useMemo } from 'react';
import { ZeroProvider } from '@rocicorp/zero/react';
import { schema } from '@/zero/schema';
import { mutators } from '@/zero/mutators';
import { useAuth } from './auth-provider';
import { ZeroReadyContext } from './zero-ready-context';

function getRequiredEnvVar(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is not defined`);
  }

  return value;
}

export function ZeroAppProvider({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const cacheURL = getRequiredEnvVar(import.meta.env.VITE_ZERO_CACHE_URL, 'VITE_ZERO_CACHE_URL');
  const appURL = getRequiredEnvVar(import.meta.env.VITE_APP_URL, 'VITE_APP_URL');
  const zeroAPIURL = import.meta.env.VITE_ZERO_API_URL || appURL;

  const zeroContext = useMemo(
    () =>
      session
        ? { userID: session.user.id, email: session.user.email ?? '' }
        : { userID: 'anon', email: '' },
    [session?.user?.id, session?.user?.email]
  );
  const zeroIdentity = session ? { userID: session.user.id } : {};
  const zeroIdentityKey = session ? `user:${session.user.id}` : 'anonymous';

  // Resolve and refresh the stored session before opening a sync connection.
  // Otherwise startup creates an anonymous/stale-token connection, then tears
  // it down while its queries are still being initialized.
  if (loading) return null;

  return (
    <ZeroReadyContext.Provider value={true}>
      <ZeroProvider
        key={zeroIdentityKey}
        {...zeroIdentity}
        context={zeroContext}
        cacheURL={cacheURL}
        queryURL={`${zeroAPIURL}/api/query`}
        mutateURL={`${zeroAPIURL}/api/mutate`}
        auth={session?.access_token ?? undefined}
        schema={schema}
        mutators={mutators}
      >
        {children}
      </ZeroProvider>
    </ZeroReadyContext.Provider>
  );
}

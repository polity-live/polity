import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

type AuthMethod = 'password' | 'otp' | 'oauth' | 'unknown';

interface AuthUser {
  id: string;
  email: string;
  hasPassword: boolean | null;
  linkedProviders: string[];
  primaryProvider: string | null;
  currentAuthMethods: string[];
  currentAuthMethod: AuthMethod;
}

interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  authStateLoading: boolean;
  refreshAuthState: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Start the browser client's storage/session initialization during module
// evaluation, while the remaining route code loads. This holds no validated
// identity: the provider still calls getUser before opening the loading gate.
const browserSupabase = typeof window === 'undefined' ? undefined : createClient();

interface AccessTokenClaims {
  amr?: (string | { method?: string })[];
}

function decodeAccessTokenClaims(accessToken?: string): AccessTokenClaims | null {
  if (!accessToken) {
    return null;
  }

  try {
    const [, payload] = accessToken.split('.');
    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      '='
    );
    return JSON.parse(atob(paddedPayload)) as AccessTokenClaims;
  } catch {
    return null;
  }
}

function normalizeAmrMethods(amr?: (string | { method?: string })[]): string[] {
  if (!amr) {
    return [];
  }

  return amr
    .map(entry => (typeof entry === 'string' ? entry : entry.method))
    .filter((method): method is string => typeof method === 'string' && method.length > 0);
}

function deriveCurrentAuthMethod(methods: string[]): AuthMethod {
  if (methods.includes('password')) {
    return 'password';
  }

  if (methods.includes('otp') || methods.includes('magiclink')) {
    return 'otp';
  }

  if (methods.includes('oauth') || methods.some(method => method.startsWith('oauth_provider/'))) {
    return 'oauth';
  }

  return 'unknown';
}

function isInvalidAuthSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; name?: unknown; status?: unknown };
  return (
    candidate.status === 401 ||
    candidate.name === 'AuthSessionMissingError' ||
    candidate.name === 'AuthInvalidTokenResponseError' ||
    candidate.code === 'refresh_token_not_found' ||
    candidate.code === 'session_not_found'
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUserRecord, setAuthUserRecord] = useState<User | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [authStateLoading, setAuthStateLoading] = useState(false);
  const [authEventVersion, setAuthEventVersion] = useState(0);
  const supabase = useMemo(() => browserSupabase ?? createClient(), []);
  const authGeneration = useRef(0);
  const userValidations = useRef(new Map<string, ReturnType<typeof supabase.auth.getUser>>());
  const validateUser = useCallback(
    (accessToken?: string) => {
      if (!accessToken) return supabase.auth.getUser();
      const running = userValidations.current.get(accessToken);
      if (running) return running;
      const pending = supabase.auth.getUser(accessToken).finally(() => {
        if (userValidations.current.get(accessToken) === pending)
          userValidations.current.delete(accessToken);
      });
      userValidations.current.set(accessToken, pending);
      return pending;
    },
    [supabase]
  );

  const refreshAuthState = useCallback(async () => {
    const generation = authGeneration.current;
    if (!session?.user) {
      setAuthUserRecord(null);
      setHasPassword(null);
      setAuthStateLoading(false);
      return;
    }

    setAuthStateLoading(true);

    try {
      const [
        { data: authUserData, error: authUserError },
        { data: passwordData, error: passwordError },
      ] = await Promise.all([
        validateUser(session.access_token),
        supabase.rpc('current_user_has_password'),
      ]);
      if (generation !== authGeneration.current) return;

      if (authUserError) {
        if (isInvalidAuthSessionError(authUserError)) {
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setAuthUserRecord(null);
          setHasPassword(null);
          return;
        }
        console.error('Failed to fetch auth user:', authUserError);
        setAuthUserRecord(session.user);
      } else {
        setAuthUserRecord(authUserData.user ?? session.user);
      }

      if (passwordError) {
        console.error('Failed to fetch auth state:', passwordError);
        setHasPassword(null);
        return;
      }

      setHasPassword(typeof passwordData === 'boolean' ? passwordData : null);
    } catch (error) {
      if (generation !== authGeneration.current) return;
      console.error('Failed to fetch auth state:', error);
      setAuthUserRecord(session.user);
      setHasPassword(null);
    } finally {
      if (generation === authGeneration.current) setAuthStateLoading(false);
    }
  }, [session?.access_token, session?.user, supabase, validateUser]);

  // Start session I/O at commit, before the first paint. Validation still
  // finishes before loading is cleared and the authenticated Zero client mounts.
  useLayoutEffect(() => {
    let cancelled = false;
    const initialGeneration = authGeneration.current;
    const getSession = async () => {
      const startedGeneration = initialGeneration;
      const {
        data: { session: storedSession },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (startedGeneration !== authGeneration.current) {
        setLoading(false);
        return;
      }
      let nextSession = storedSession;

      if (
        storedSession &&
        Number.isFinite(storedSession.expires_at) &&
        (storedSession.expires_at as number) * 1000 > Date.now() + 60_000
      ) {
        // A fresh stored JWT still needs server validation, but rotating its
        // refresh token again needlessly delays every application boot.
        const { data, error } = await validateUser(storedSession.access_token);
        if (cancelled) return;
        if (startedGeneration !== authGeneration.current) {
          setLoading(false);
          return;
        }
        if ((error && isInvalidAuthSessionError(error)) || (!error && !data.user)) {
          await supabase.auth.signOut({ scope: 'local' });
          nextSession = null;
        } else if (error) {
          console.error('Failed to validate stored auth session:', error);
        } else if (data.user?.id !== storedSession.user.id) {
          await supabase.auth.signOut({ scope: 'local' });
          nextSession = null;
        } else {
          nextSession = { ...storedSession, user: data.user };
        }
      } else if (storedSession) {
        const { data, error } = await supabase.auth.refreshSession();
        if (cancelled) return;
        if (startedGeneration !== authGeneration.current) {
          setLoading(false);
          return;
        }
        if (error && isInvalidAuthSessionError(error)) {
          await supabase.auth.signOut({ scope: 'local' });
          nextSession = null;
        } else if (error) {
          console.error('Failed to refresh stored auth session:', error);
        } else {
          nextSession = data.session;
        }
      }

      if (!cancelled) {
        // A concurrent sign-out/account change must win over this older result.
        if (startedGeneration === authGeneration.current) {
          setSession(nextSession);
          setAuthUserRecord(nextSession?.user ?? null);
        }
        setLoading(false);
      }
    };

    void getSession().catch(error => {
      console.error('Failed to initialize auth session:', error);
      if (!cancelled) {
        if (initialGeneration === authGeneration.current) {
          setSession(null);
          setAuthUserRecord(null);
        }
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' && authGeneration.current !== initialGeneration) return;
      if (event !== 'INITIAL_SESSION') {
        authGeneration.current++;
        setAuthEventVersion(version => version + 1);
      }
      setSession(session);
      setAuthUserRecord(session?.user ?? null);
      // INITIAL_SESSION can arrive before the stored token has been refreshed.
      // Only getSession may release the initial loading gate.
    });

    return () => {
      cancelled = true;
      authGeneration.current++;
      subscription.unsubscribe();
    };
  }, [supabase, validateUser]);

  const automaticRefresh = useRef(refreshAuthState);
  automaticRefresh.current = refreshAuthState;
  useEffect(() => {
    // Replacing the stored user object with the freshly validated object is
    // not a new auth event. Actual events (including USER_UPDATED with the
    // same JWT) and explicit refreshes still call getUser again.
    void automaticRefresh.current();
  }, [session?.access_token, session?.user?.id, authEventVersion]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
  }, [supabase]);

  const currentAuthMethods = useMemo(
    () => normalizeAmrMethods(decodeAccessTokenClaims(session?.access_token)?.amr),
    [session?.access_token]
  );

  const resolvedAuthUser = authUserRecord ?? session?.user ?? null;

  const linkedProviders = useMemo(() => {
    const providers = resolvedAuthUser?.app_metadata.providers;
    if (Array.isArray(providers) && providers.length > 0) {
      return providers.filter(
        (provider): provider is string => typeof provider === 'string' && provider.length > 0
      );
    }

    const provider = resolvedAuthUser?.app_metadata.provider;
    return typeof provider === 'string' && provider.length > 0 ? [provider] : [];
  }, [resolvedAuthUser?.app_metadata.provider, resolvedAuthUser?.app_metadata.providers]);

  const primaryProvider = useMemo(() => {
    const provider = resolvedAuthUser?.app_metadata.provider;
    return typeof provider === 'string' && provider.length > 0 ? provider : null;
  }, [resolvedAuthUser?.app_metadata.provider]);

  const currentAuthMethod = useMemo(
    () => deriveCurrentAuthMethod(currentAuthMethods),
    [currentAuthMethods]
  );

  const user: AuthUser | null = useMemo(
    () =>
      resolvedAuthUser
        ? {
            id: resolvedAuthUser.id,
            email: resolvedAuthUser.email ?? '',
            hasPassword,
            linkedProviders,
            primaryProvider,
            currentAuthMethods,
            currentAuthMethod,
          }
        : null,
    [
      currentAuthMethod,
      currentAuthMethods,
      hasPassword,
      linkedProviders,
      primaryProvider,
      resolvedAuthUser,
    ]
  );

  const value = useMemo(
    () => ({ session, user, loading, authStateLoading, refreshAuthState, signOut }),
    [session, user, loading, authStateLoading, refreshAuthState, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useOptionalAuth() {
  return useContext(AuthContext) ?? null;
}

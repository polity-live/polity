import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session, User } from '@supabase/supabase-js'

type AuthMethod = 'password' | 'otp' | 'oauth' | 'unknown'

interface AuthUser {
  id: string
  email: string
  hasPassword: boolean | null
  linkedProviders: string[]
  primaryProvider: string | null
  currentAuthMethods: string[]
  currentAuthMethod: AuthMethod
}

interface AuthContextType {
  session: Session | null
  user: AuthUser | null
  loading: boolean
  authStateLoading: boolean
  refreshAuthState: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AccessTokenClaims {
  amr?: Array<string | { method?: string }>
}

function decodeAccessTokenClaims(accessToken?: string): AccessTokenClaims | null {
  if (!accessToken) {
    return null
  }

  try {
    const [, payload] = accessToken.split('.')
    if (!payload) {
      return null
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=')
    return JSON.parse(atob(paddedPayload)) as AccessTokenClaims
  } catch {
    return null
  }
}

function normalizeAmrMethods(amr?: Array<string | { method?: string }>): string[] {
  if (!amr) {
    return []
  }

  return amr
    .map(entry => typeof entry === 'string' ? entry : entry.method)
    .filter((method): method is string => typeof method === 'string' && method.length > 0)
}

function deriveCurrentAuthMethod(methods: string[]): AuthMethod {
  if (methods.includes('password')) {
    return 'password'
  }

  if (methods.includes('otp') || methods.includes('magiclink')) {
    return 'otp'
  }

  if (methods.includes('oauth') || methods.some(method => method.startsWith('oauth_provider/'))) {
    return 'oauth'
  }

  return 'unknown'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authUserRecord, setAuthUserRecord] = useState<User | null>(null)
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [authStateLoading, setAuthStateLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const refreshAuthState = useCallback(async () => {
    if (!session?.user) {
      setAuthUserRecord(null)
      setHasPassword(null)
      setAuthStateLoading(false)
      return
    }

    setAuthStateLoading(true)

    try {
      const [
        { data: authUserData, error: authUserError },
        { data: passwordData, error: passwordError },
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc('current_user_has_password'),
      ])

      if (authUserError) {
        console.error('Failed to fetch auth user:', authUserError)
        setAuthUserRecord(session.user)
      } else {
        setAuthUserRecord(authUserData.user ?? session.user)
      }

      if (passwordError) {
        console.error('Failed to fetch auth state:', passwordError)
        setHasPassword(null)
        return
      }

      setHasPassword(typeof passwordData === 'boolean' ? passwordData : null)
    } catch (error) {
      console.error('Failed to fetch auth state:', error)
      setAuthUserRecord(session.user)
      setHasPassword(null)
    } finally {
      setAuthStateLoading(false)
    }
  }, [session?.access_token, session?.user, supabase])

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setSession(session)
      setAuthUserRecord(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthUserRecord(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    void refreshAuthState()
  }, [refreshAuthState])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [supabase])

  const currentAuthMethods = useMemo(
    () => normalizeAmrMethods(decodeAccessTokenClaims(session?.access_token)?.amr),
    [session?.access_token]
  )

  const resolvedAuthUser = authUserRecord ?? session?.user ?? null

  const linkedProviders = useMemo(() => {
    const providers = resolvedAuthUser?.app_metadata.providers
    if (Array.isArray(providers) && providers.length > 0) {
      return providers.filter((provider): provider is string => typeof provider === 'string' && provider.length > 0)
    }

    const provider = resolvedAuthUser?.app_metadata.provider
    return typeof provider === 'string' && provider.length > 0 ? [provider] : []
  }, [resolvedAuthUser?.app_metadata.provider, resolvedAuthUser?.app_metadata.providers])

  const primaryProvider = useMemo(() => {
    const provider = resolvedAuthUser?.app_metadata.provider
    return typeof provider === 'string' && provider.length > 0 ? provider : null
  }, [resolvedAuthUser?.app_metadata.provider])

  const currentAuthMethod = useMemo(
    () => deriveCurrentAuthMethod(currentAuthMethods),
    [currentAuthMethods]
  )

  const user: AuthUser | null = useMemo(
    () => resolvedAuthUser
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
    [currentAuthMethod, currentAuthMethods, hasPassword, linkedProviders, primaryProvider, resolvedAuthUser]
  )

  const value = useMemo(
    () => ({ session, user, loading, authStateLoading, refreshAuthState, signOut }),
    [session, user, loading, authStateLoading, refreshAuthState, signOut]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

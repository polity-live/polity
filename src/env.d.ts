/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ZERO_CACHE_URL: string
  readonly VITE_APP_URL: string
  readonly VITE_GEOAPIFY_API_KEY: string
  readonly VITE_PRESENCE_WS_URL: string
  readonly VITE_VAPID_PUBLIC_KEY: string
}

declare namespace NodeJS {
  interface ProcessEnv {
    readonly FRANKFURTER_API_BASE_URL?: string
    STRIPE_MODE?: 'test' | 'live'
    STRIPE_SECRET_KEY?: string
    STRIPE_WEBHOOK_SECRET?: string
    STRIPE_PRICE_RUNNING?: string
    STRIPE_PRICE_DEVELOPMENT?: string
    STRIPE_PRODUCT_CUSTOM?: string
    STRIPE_PORTAL_CONFIGURATION_ID?: string
  }
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

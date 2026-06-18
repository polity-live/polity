import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { AuthProvider } from '@/providers/auth-provider';
import { OnlineUsersProvider } from '@/presence';
import { ZeroAppProvider } from '@/providers/zero-provider';
import { AppShell } from '@/layout/app-shell';
import { NotFound } from '@/features/shared/ui/ui/not-found';
import { MotionProvider } from '@/features/shared/motion';
import stylesAssetHref from '../styles.css?url';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const stylesHref = import.meta.env.DEV ? '/_build/src/styles.css' : stylesAssetHref;

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { name: 'theme-color', content: '#F7F5EF' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'Polity' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      {
        name: 'google-site-verification',
        content: 'nIqXCPvlgZ-T0vUb9DimlNa8oLmNZbj5VLIYfN_s08g',
      },
      { title: translateText('generated.inline.0614_polity_f147ffe2') },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&display=swap',
      },
      { rel: 'stylesheet', href: stylesHref },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
    ],
  }),
  component: RootLayout,
});

function RootLayout() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {/* Blocking script to apply dark class before first paint — prevents flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        <MotionProvider>
          <AuthProvider>
            <OnlineUsersProvider>
              <ZeroAppProvider>
                <AppShell>
                  <Outlet />
                </AppShell>
              </ZeroAppProvider>
            </OnlineUsersProvider>
          </AuthProvider>
        </MotionProvider>
        <Scripts />
      </body>
    </html>
  );
}

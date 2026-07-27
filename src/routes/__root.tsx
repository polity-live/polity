import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import '@/font-faces.css';
import { AuthProvider } from '@/providers/auth-provider';
import { AppRuntime } from '@/runtime/app-runtime';
import { AppShell } from '@/layout/app-shell';
import { NotFound } from '@/features/shared/ui/ui/not-found';
import { MotionProvider } from '@/features/shared/motion';
import { TooltipProvider } from '@/features/shared/ui/ui/tooltip';
import { KeyboardPlatformProvider } from '@/features/shared/keyboard/keyboard-shortcut';
import stylesAssetHref from '../styles.css?url';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  APPEARANCE_THEME_CACHE_KEY,
  APPEARANCE_THEME_CSS_CACHE_KEY,
  APPEARANCE_THEME_STYLE_ID,
} from '@/features/shared/appearance-theme';

const stylesHref = import.meta.env.DEV ? '/src/styles.css?direct' : stylesAssetHref;
export const earlyPwaInstallPromptCaptureScript = `(function(){try{if(window.__polityPwaInstallPromptCaptureReady)return;window.__polityPwaInstallPromptCaptureReady=true;window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();window.__polityPwaInstallPromptEvent=event;window.__polityPwaInstallPromptCapturedAt=Date.now();window.dispatchEvent(new CustomEvent('polity:pwa-install-prompt-captured',{detail:{promptEvent:event,capturedAt:window.__polityPwaInstallPromptCapturedAt}}));});}catch(error){console.warn('Failed to initialize PWA install prompt capture:',error);}})()`;

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
      { rel: 'stylesheet', href: stylesHref },
      { rel: 'manifest', href: '/manifest.en.json' },
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
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);var m=d?'dark':'light';document.documentElement.classList.add(m);document.documentElement.style.colorScheme=m;var c=localStorage.getItem('${APPEARANCE_THEME_CSS_CACHE_KEY}');if(c){var s=document.createElement('style');s.id='${APPEARANCE_THEME_STYLE_ID}';s.textContent=c;document.head.appendChild(s)}var a=JSON.parse(localStorage.getItem('${APPEARANCE_THEME_CACHE_KEY}')||'null');if(a&&a.slug){document.documentElement.dataset.appearanceTheme=a.slug;var p=d?a.dark:a.light;var tc=document.querySelector('meta[name="theme-color"]');if(tc&&p&&p.background)tc.content=p.background}var cs=document.querySelector('meta[name="color-scheme"]');if(!cs){cs=document.createElement('meta');cs.name='color-scheme';document.head.appendChild(cs)}cs.content=m}catch(e){}})()`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: earlyPwaInstallPromptCaptureScript,
          }}
        />
        <MotionProvider>
          <KeyboardPlatformProvider>
            <TooltipProvider delayDuration={250} skipDelayDuration={300}>
              <AuthProvider>
                <AppRuntime>
                  <AppShell>
                    <Outlet />
                  </AppShell>
                </AppRuntime>
              </AuthProvider>
            </TooltipProvider>
          </KeyboardPlatformProvider>
        </MotionProvider>
        <Scripts />
      </body>
    </html>
  );
}

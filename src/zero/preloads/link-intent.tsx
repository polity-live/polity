import { useEffect } from 'react';
import { useRouter, useRouterState, type AnyRouter } from '@tanstack/react-router';
import { usePreloadCoordinator } from './preload-coordinator';

export const LINK_INTENT_DELAY_MS = 50;

type IntentSource = 'pointer' | 'focus' | 'touch';

interface LinkIntentCallbacks {
  beginIntent: (href: string) => void;
  cancelIntent: (href: string) => void;
}

interface LinkIntentState {
  href: string;
  sources: Set<IntentSource>;
  started: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

function closestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
}

export function isPreloadableAppRoute(router: AnyRouter, pathname: string): boolean {
  if (pathname.startsWith('/api/')) return false;
  const { routeParams, foundRoute } = router.getMatchedRoutes(pathname);
  return Boolean(foundRoute && foundRoute.id !== '/$' && !routeParams['**']);
}

export function resolveInternalPreloadHref(
  anchor: HTMLAnchorElement,
  currentHref: string,
  isRoute: (pathname: string) => boolean
): string | undefined {
  const rawHref = anchor.getAttribute('href')?.trim();
  if (!rawHref || rawHref.startsWith('#')) return undefined;
  if (anchor.getAttribute('data-preload') === 'false') return undefined;
  if (anchor.hasAttribute('download')) return undefined;
  const target = anchor.getAttribute('target')?.toLowerCase();
  if (target && target !== '_self') return undefined;

  let current: URL;
  let targetUrl: URL;
  try {
    current = new URL(currentHref);
    targetUrl = new URL(rawHref, current);
  } catch {
    return undefined;
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol) || targetUrl.origin !== current.origin) {
    return undefined;
  }
  if (
    targetUrl.pathname === current.pathname &&
    targetUrl.search === current.search &&
    targetUrl.hash
  ) {
    return undefined;
  }
  if (!isRoute(targetUrl.pathname)) return undefined;

  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

export function installInternalLinkIntentDelegation(
  ownerDocument: Document,
  currentHref: string,
  isRoute: (pathname: string) => boolean,
  callbacks: LinkIntentCallbacks
): () => void {
  const states = new Map<HTMLAnchorElement, LinkIntentState>();

  const stop = (anchor: HTMLAnchorElement, source: IntentSource) => {
    const state = states.get(anchor);
    if (!state) return;
    state.sources.delete(source);
    if (state.sources.size > 0) return;
    if (state.timer) clearTimeout(state.timer);
    callbacks.cancelIntent(state.href);
    states.delete(anchor);
  };

  const start = (anchor: HTMLAnchorElement, source: IntentSource, delay: number) => {
    const href = resolveInternalPreloadHref(anchor, currentHref, isRoute);
    if (!href) return;

    const existing = states.get(anchor);
    if (existing?.href === href) {
      existing.sources.add(source);
      if (delay === 0 && !existing.started) {
        clearTimeout(existing.timer as ReturnType<typeof setTimeout>);
        existing.timer = null;
        existing.started = true;
        callbacks.beginIntent(href);
      }
      return;
    }

    if (existing) {
      if (existing.timer) clearTimeout(existing.timer);
      callbacks.cancelIntent(existing.href);
    }

    const state: LinkIntentState = {
      href,
      sources: new Set([source]),
      started: delay === 0,
      timer: null,
    };
    states.set(anchor, state);

    if (delay === 0) {
      callbacks.beginIntent(href);
      return;
    }

    state.timer = setTimeout(() => {
      state.timer = null;
      state.started = true;
      callbacks.beginIntent(href);
    }, delay);
  };

  const onPointerOver = (event: Event) => {
    const anchor = closestAnchor(event.target);
    if (!anchor) return;
    const relatedAnchor = closestAnchor((event as PointerEvent).relatedTarget);
    if (relatedAnchor === anchor) return;
    start(anchor, 'pointer', LINK_INTENT_DELAY_MS);
  };
  const onPointerOut = (event: Event) => {
    const anchor = closestAnchor(event.target);
    if (!anchor) return;
    const relatedAnchor = closestAnchor((event as PointerEvent).relatedTarget);
    if (relatedAnchor === anchor) return;
    stop(anchor, 'pointer');
  };
  const onFocusIn = (event: Event) => {
    const anchor = closestAnchor(event.target);
    if (anchor) start(anchor, 'focus', 0);
  };
  const onFocusOut = (event: Event) => {
    const anchor = closestAnchor(event.target);
    if (!anchor) return;
    const relatedAnchor = closestAnchor((event as FocusEvent).relatedTarget);
    if (relatedAnchor === anchor) return;
    stop(anchor, 'focus');
  };
  const onTouchStart = (event: Event) => {
    const anchor = closestAnchor(event.target);
    if (anchor) start(anchor, 'touch', 0);
  };

  ownerDocument.addEventListener('pointerover', onPointerOver);
  ownerDocument.addEventListener('pointerout', onPointerOut);
  ownerDocument.addEventListener('focusin', onFocusIn);
  ownerDocument.addEventListener('focusout', onFocusOut);
  ownerDocument.addEventListener('touchstart', onTouchStart, { passive: true });

  return () => {
    ownerDocument.removeEventListener('pointerover', onPointerOver);
    ownerDocument.removeEventListener('pointerout', onPointerOut);
    ownerDocument.removeEventListener('focusin', onFocusIn);
    ownerDocument.removeEventListener('focusout', onFocusOut);
    ownerDocument.removeEventListener('touchstart', onTouchStart);
    for (const state of states.values()) {
      if (state.timer) clearTimeout(state.timer);
      callbacks.cancelIntent(state.href);
    }
    states.clear();
  };
}

export function InternalLinkIntentPreloader() {
  const router = useRouter();
  const currentHref = useRouterState({ select: state => state.location.href });
  const preloadContext = usePreloadCoordinator();

  useEffect(
    () =>
      installInternalLinkIntentDelegation(
        document,
        new URL(currentHref, window.location.origin).href,
        pathname => isPreloadableAppRoute(router, pathname),
        {
          beginIntent: href => {
            void router.preloadRoute({ to: href } as never).catch(error => {
              console.warn(`Route preload failed for ${href}`, error);
            });
            preloadContext?.beginIntent(href, 0);
          },
          cancelIntent: href => preloadContext?.cancelIntent(href),
        }
      ),
    [currentHref, preloadContext, router]
  );

  return null;
}

import { useEffect } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';

const LINK_INTENT_DELAY_MS = 50;

function closestInternalAnchor(target: EventTarget | null) {
  const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!anchor || anchor.target || anchor.download || anchor.dataset.preload === 'false')
    return null;

  const href = anchor.getAttribute('href')?.trim();
  if (!href || href.startsWith('#')) return null;
  return anchor;
}

export function RouteLinkIntentPreloader() {
  const router = useRouter();
  const currentHref = useRouterState({ select: state => state.location.href });

  useEffect(() => {
    const timers = new Map<HTMLAnchorElement, ReturnType<typeof setTimeout>>();

    const preload = (anchor: HTMLAnchorElement) => {
      let target: URL;
      try {
        target = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (target.origin !== window.location.origin || target.pathname.startsWith('/api/')) return;
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search &&
        target.hash
      ) {
        return;
      }

      void router
        .preloadRoute({ to: `${target.pathname}${target.search}${target.hash}` } as never)
        .catch(() => undefined);
    };

    const cancel = (anchor: HTMLAnchorElement | null) => {
      if (!anchor) return;
      const timer = timers.get(anchor);
      if (timer) clearTimeout(timer);
      timers.delete(anchor);
    };

    const onPointerOver = (event: PointerEvent) => {
      const anchor = closestInternalAnchor(event.target);
      if (!anchor || timers.has(anchor)) return;
      timers.set(
        anchor,
        setTimeout(() => {
          timers.delete(anchor);
          preload(anchor);
        }, LINK_INTENT_DELAY_MS)
      );
    };

    const onPointerOut = (event: PointerEvent) => cancel(closestInternalAnchor(event.target));
    const onFocusIn = (event: FocusEvent) => {
      const anchor = closestInternalAnchor(event.target);
      if (anchor) preload(anchor);
    };

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('focusin', onFocusIn);
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [currentHref, router]);

  return null;
}

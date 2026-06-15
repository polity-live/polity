'use client';

import * as React from 'react';
import { Link } from '@tanstack/react-router';

const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const PROTOCOL_RELATIVE_PATTERN = /^\/\//;
const HTTP_URL_SCHEME_PATTERN = /^https?:/i;

export function isExternalHref(href: string): boolean {
  return toRouterHref(href) === null && !href.startsWith('#');
}

export function toRouterHref(href: string): string | null {
  if (!href || href.startsWith('#') || PROTOCOL_RELATIVE_PATTERN.test(href)) {
    return null;
  }

  if (URL_SCHEME_PATTERN.test(href)) {
    if (!HTTP_URL_SCHEME_PATTERN.test(href)) {
      return null;
    }

    if (typeof window === 'undefined' || !window.location?.origin) {
      return null;
    }

    try {
      const url = new URL(href);
      if (url.origin !== window.location.origin) {
        return null;
      }

      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  if (href.startsWith('/')) {
    return href;
  }

  return null;
}

type SmartLinkProps = Omit<React.ComponentPropsWithoutRef<'a'>, 'href'> & {
  href: string;
  resetScroll?: boolean;
};

export const SmartLink = React.forwardRef<HTMLAnchorElement, SmartLinkProps>(
  ({ href, resetScroll, ...props }, ref) => {
    const linkHref = href ?? '';
    const routerHref = toRouterHref(linkHref);
    const shouldUseNativeAnchor =
      routerHref === null ||
      linkHref.startsWith('#') ||
      (props.download !== undefined && props.download !== false) ||
      (props.target !== undefined && props.target !== '_self');

    if (shouldUseNativeAnchor) {
      return <a ref={ref} href={linkHref} {...props} />;
    }

    return resetScroll === undefined ? (
      <Link ref={ref} to={routerHref as never} {...props} />
    ) : (
      <Link ref={ref} to={routerHref as never} resetScroll={resetScroll} {...props} />
    );
  }
);
SmartLink.displayName = 'SmartLink';

export function isPlainLeftClick(
  event: Pick<React.MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>
) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

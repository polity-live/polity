'use client';

import * as React from 'react';
import { Link } from '@tanstack/react-router';

const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const PROTOCOL_RELATIVE_PATTERN = /^\/\//;

export function isExternalHref(href: string): boolean {
  return URL_SCHEME_PATTERN.test(href) || PROTOCOL_RELATIVE_PATTERN.test(href);
}

type SmartLinkProps = Omit<React.ComponentPropsWithoutRef<'a'>, 'href'> & {
  href: string;
  resetScroll?: boolean;
};

export const SmartLink = React.forwardRef<HTMLAnchorElement, SmartLinkProps>(
  ({ href, resetScroll, ...props }, ref) => {
    if (isExternalHref(href)) {
      return <a ref={ref} href={href} {...props} />;
    }

    return resetScroll === undefined ? (
      <Link ref={ref} to={href as never} {...props} />
    ) : (
      <Link ref={ref} to={href as never} resetScroll={resetScroll} {...props} />
    );
  }
);
SmartLink.displayName = 'SmartLink';

export function isPlainLeftClick(
  event: Pick<React.MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>
) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

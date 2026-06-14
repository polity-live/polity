'use client';

import * as React from 'react';
import { cn } from '@/features/shared/utils/utils.ts';
import { SmartLink } from './SmartLink.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface LinkSurfaceProps extends Omit<React.ComponentPropsWithoutRef<'a'>, 'href'> {
  href: string;
  mode?: 'simple' | 'overlay';
  containerClassName?: string;
  contentClassName?: string;
  label?: string;
  resetScroll?: boolean;
  children: React.ReactNode;
}

export function LinkSurface({
  href,
  mode = 'simple',
  containerClassName,
  contentClassName,
  label = translateText('generated.inline.0149_open_link_d2de1a28'),
  resetScroll,
  children,
  className,
  ...props
}: LinkSurfaceProps) {
  if (mode === 'simple') {
    return (
      <SmartLink href={href} resetScroll={resetScroll} className={className} {...props}>
        {children}
      </SmartLink>
    );
  }

  return (
    <div className={cn('relative', containerClassName)}>
      <SmartLink
        href={href}
        resetScroll={resetScroll}
        aria-label={props['aria-label'] ?? label}
        className={cn(
          'focus-visible:ring-ring focus-visible:ring-offset-background absolute inset-0 z-0 rounded-[inherit] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          className
        )}
        {...props}
      >
        <span className="sr-only">{label}</span>
      </SmartLink>
      <div
        className={cn(
          'pointer-events-none relative z-10 [&_[data-link-interactive=true]]:pointer-events-auto [&_[data-slot=popover-trigger]]:pointer-events-auto [&_[data-slot=tooltip-trigger]]:pointer-events-auto [&_[role=button]]:pointer-events-auto [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_label]:pointer-events-auto [&_select]:pointer-events-auto [&_textarea]:pointer-events-auto',
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

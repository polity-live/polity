'use client';

import * as React from 'react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

/**
 * Component wrapper that adds focus visibility ring
 */
export interface FocusRingProps {
  children: React.ReactNode;
  className?: string;
}

export function FocusRing({ children, className }: FocusRingProps) {
  return (
    <div
      className={`focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${className || ''}`}
    >
      {children}
    </div>
  );
}

/**
 * Skip link for keyboard users to skip to main timeline content
 */
export function SkipToTimeline() {
  return (
    <a
      data-action-id="timeline.accessibility.skip-content"
      data-action-kind="navigation"
      href="#timeline-content"
      className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2"
    >
      {translateText('generated.inline.1156_skip_to_timeline_7cc43832')}
    </a>
  );
}

/**
 * Wrapper that adds timeline content landmark
 */
export interface TimelineRegionProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function TimelineRegion({
  children,
  label = translateText('generated.inline.0172_timeline_content_f22c74a4'),
  className,
}: TimelineRegionProps) {
  return (
    <main id="timeline-content" role="main" aria-label={label} className={className}>
      {children}
    </main>
  );
}

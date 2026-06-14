import * as React from 'react';

import { cn } from '@/features/shared/utils/utils.ts';

import { Toolbar } from '@/features/shared/ui/layout';

export interface FloatingToolbarViewProps {
  children: any;
  className: any;
  state: any;
  props: any;
  editorId: any;
  focusedEditorId: any;
  isFloatingLinkOpen: any;
  isAIChatOpen: any;
  floatingToolbarState: any;
  clickOutsideRef: any;
  hidden: any;
  rootProps: any;
  floatingRef: any;
  ref: any;
}

export function FloatingToolbarView({
  children,
  className,
  props,
  clickOutsideRef,
  hidden,
  rootProps,
  ref,
}: FloatingToolbarViewProps) {
  if (hidden) return null;

  return (
    <div ref={clickOutsideRef}>
      <Toolbar
        {...props}
        {...rootProps}
        ref={ref}
        className={cn(
          'scrollbar-hide bg-popover absolute z-50 overflow-x-auto rounded-md border p-1 whitespace-nowrap opacity-100 shadow-md print:hidden',
          'max-w-[80vw]',
          className
        )}
      >
        {children}
      </Toolbar>
    </div>
  );
}

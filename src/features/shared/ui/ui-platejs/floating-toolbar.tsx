import * as React from 'react';

import { type FloatingToolbarState } from '@platejs/floating';

import { Toolbar } from '@/features/shared/ui/layout';

import { useFloatingToolbarController } from './useFloatingToolbarController';
import { FloatingToolbarView } from './FloatingToolbarView';

export function FloatingToolbar({
  children,
  className,
  state,
  ...props
}: React.ComponentProps<typeof Toolbar> & {
  state?: FloatingToolbarState;
}) {
  const viewProps = useFloatingToolbarController({ children, className, state, ...props });

  return <FloatingToolbarView {...viewProps} />;
}

import type { ReactNode } from 'react';
import type { WithRequiredKey } from 'platejs';

import { useMediaToolbarController } from '@/features/shared/hooks/useMediaToolbarController';
import { MediaToolbarView } from './MediaToolbarView';

export function MediaToolbar({
  children,
  plugin,
}: {
  children: ReactNode;
  plugin: WithRequiredKey;
}) {
  return (
    <MediaToolbarView plugin={plugin} {...useMediaToolbarController()}>
      {children}
    </MediaToolbarView>
  );
}

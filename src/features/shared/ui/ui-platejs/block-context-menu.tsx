import * as React from 'react';
import { useBlockContextMenuController } from './useBlockContextMenuController';
import { BlockContextMenuView } from './BlockContextMenuView';

export function BlockContextMenu({ children }: { children: React.ReactNode }) {
  const viewProps = useBlockContextMenuController({ children });

  return <BlockContextMenuView {...viewProps} />;
}

import * as React from 'react';

import { ToolbarButton } from '@/features/shared/ui/layout';

import { useToggleToolbarButtonController } from './useToggleToolbarButtonController';
import { ToggleToolbarButtonView } from './ToggleToolbarButtonView';

export function ToggleToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const viewProps = useToggleToolbarButtonController(props);

  return <ToggleToolbarButtonView {...viewProps} />;
}

import * as React from 'react';

import { ToolbarButton } from '@/features/shared/ui/layout';

import { useMarkToolbarButtonController } from './useMarkToolbarButtonController';
import { MarkToolbarButtonView } from './MarkToolbarButtonView';

export function MarkToolbarButton({
  clear,
  nodeType,
  ...props
}: React.ComponentProps<typeof ToolbarButton> & {
  nodeType: string;
  clear?: string[] | string;
}) {
  const viewProps = useMarkToolbarButtonController({ clear, nodeType, ...props });

  return <MarkToolbarButtonView {...viewProps} />;
}

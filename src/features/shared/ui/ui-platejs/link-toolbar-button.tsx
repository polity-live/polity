import * as React from 'react';

import { ToolbarButton } from '@/features/shared/ui/layout';

import { useLinkToolbarButtonController } from './useLinkToolbarButtonController';
import { LinkToolbarButtonView } from './LinkToolbarButtonView';

export function LinkToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const viewProps = useLinkToolbarButtonController(props);

  return <LinkToolbarButtonView {...viewProps} />;
}

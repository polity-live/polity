import * as React from 'react';

import { ToolbarButton } from '@/features/shared/ui/layout';
export interface AIToolbarButtonViewProps {
  props: any;
  api: any;
}

export function AIToolbarButtonView({ props, api }: AIToolbarButtonViewProps) {
  return (
    <ToolbarButton
      {...props}
      onClick={() => {
        api.aiChat.show();
      }}
      onMouseDown={e => {
        e.preventDefault();
      }}
    />
  );
}

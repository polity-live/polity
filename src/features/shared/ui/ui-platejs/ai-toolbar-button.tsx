import * as React from 'react';

import { AIChatPlugin } from '@platejs/ai/react';
import { useEditorPlugin } from 'platejs/react';

import { ToolbarButton } from '@/features/shared/ui/layout';

export function AIToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const { api } = useEditorPlugin(AIChatPlugin);

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

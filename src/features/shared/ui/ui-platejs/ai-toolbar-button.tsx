import * as React from 'react';

import { AIChatPlugin } from '@platejs/ai/react';
import { useEditorPlugin } from 'platejs/react';

import { ToolbarButton } from '@/features/shared/ui/layout';
import { AIToolbarButtonView } from './AIToolbarButtonView';
export function AIToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const { api, editor } = useEditorPlugin(AIChatPlugin);
  return <AIToolbarButtonView props={props} api={api} editor={editor} />;
}

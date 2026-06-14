import { CopilotPlugin } from '@platejs/ai/react';
import { useElement, usePluginOption } from 'platejs/react';
import { GhostTextView } from './GhostTextView';
export function GhostText() {
  const element = useElement();

  const isSuggested = usePluginOption(CopilotPlugin, 'isSuggested', element.id as string);
  return <GhostTextView element={element} isSuggested={isSuggested} />;
}

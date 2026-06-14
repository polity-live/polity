import { CopilotPlugin } from '@platejs/ai/react';
import { usePluginOption } from 'platejs/react';

function GhostTextContent() {
  const suggestionText = usePluginOption(CopilotPlugin, 'suggestionText');

  return (
    <span
      className="text-muted-foreground/70 pointer-events-none max-sm:hidden"
      contentEditable={false}
    >
      {suggestionText && suggestionText}
    </span>
  );
}

export interface GhostTextViewProps {
  element: any;
  isSuggested: any;
}

export function GhostTextView({ isSuggested }: GhostTextViewProps) {
  if (!isSuggested) return null;

  return <GhostTextContent />;
}

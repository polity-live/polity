import * as React from 'react';

import { useAIChatEditor } from '@platejs/ai/react';
import { usePlateViewEditor } from 'platejs/react';

import { BaseEditorKit } from '@/features/shared/ui/kit-platejs/editor-base-kit.tsx';

import { EditorStatic } from './editor-static.tsx';

export const AIChatEditor = React.memo(function AIChatEditor({ content }: { content: string }) {
  // Static previews must not inject interactive selectors bound to the parent Plate store.
  const aiEditor = usePlateViewEditor({
    plugins: BaseEditorKit,
  });

  useAIChatEditor(aiEditor, content);

  return <EditorStatic variant="aiChat" editor={aiEditor} />;
});

'use client';

import type { EditorViewProps } from '../types';
import { useEditorViewModel } from '../hooks/useEditorViewModel';
import { EditorViewShell } from './EditorViewShell';

export function EditorView(props: EditorViewProps) {
  const model = useEditorViewModel(props);

  return <EditorViewShell model={model} />;
}

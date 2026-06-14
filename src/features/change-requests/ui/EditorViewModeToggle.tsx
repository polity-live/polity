'use client';

import { useEditorViewModeToggleController } from '../hooks/useEditorViewModeToggleController';
import { EditorViewModeToggleView } from './EditorViewModeToggleView';

export type EditorViewMode = 'all' | 'single';

interface ChangeRequestOption {
  id: string;
  crId: string;
  title: string;
  type: string;
}

interface EditorViewModeToggleProps {
  mode: EditorViewMode;
  onModeChange: (mode: EditorViewMode) => void;
  selectedCRId: string | null;
  onSelectedCRChange: (crId: string | null) => void;
  changeRequests: ChangeRequestOption[];
}

export function EditorViewModeToggle(props: EditorViewModeToggleProps) {
  return <EditorViewModeToggleView {...props} {...useEditorViewModeToggleController(props)} />;
}

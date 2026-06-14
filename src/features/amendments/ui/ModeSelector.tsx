'use client';

import type { EditorMode } from '@/features/editor/types';
import { useModeSelectorController } from '../hooks/useModeSelectorController';
import { ModeSelectorView } from './ModeSelectorView';

interface ModeSelectorProps {
  documentId: string;
  currentMode: EditorMode | string;
  isOwnerOrCollaborator: boolean;
}

export function ModeSelector({
  documentId,
  currentMode,
  isOwnerOrCollaborator,
}: ModeSelectorProps) {
  const { handleModeChange } = useModeSelectorController({ documentId });

  return (
    <ModeSelectorView
      documentId={documentId}
      currentMode={currentMode}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
      onModeChange={handleModeChange}
    />
  );
}

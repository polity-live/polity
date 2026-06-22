'use client';

import type { EditorMode } from '@/features/editor/types';
import { useBlogModeSelectorController } from '../hooks/useBlogModeSelectorController';
import { ModeSelectorView } from './ModeSelectorView';

interface ModeSelectorProps {
  blogId: string;
  currentMode: EditorMode;
  isOwnerOrCollaborator: boolean;
}

export function ModeSelector({ blogId, currentMode, isOwnerOrCollaborator }: ModeSelectorProps) {
  const { handleModeChange } = useBlogModeSelectorController({ blogId });

  return (
    <ModeSelectorView
      blogId={blogId}
      currentMode={currentMode}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
      onModeChange={handleModeChange}
    />
  );
}

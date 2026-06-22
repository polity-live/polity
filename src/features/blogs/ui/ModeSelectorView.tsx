import { ModeSelector as EditorModeSelector } from '@/features/editor/ui/ModeSelector';
import type { EditorMode } from '@/features/editor/types';

interface ModeSelectorViewProps {
  blogId: string;
  currentMode: EditorMode;
  isOwnerOrCollaborator: boolean;
  onModeChange: (newMode: EditorMode) => Promise<void>;
}

export function ModeSelectorView({
  blogId,
  currentMode,
  isOwnerOrCollaborator,
  onModeChange,
}: ModeSelectorViewProps) {
  return (
    <EditorModeSelector
      entityType="blog"
      entityId={blogId}
      currentMode={currentMode}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
      onModeChange={onModeChange}
    />
  );
}

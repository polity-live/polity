import { ModeSelector as EditorModeSelector } from '@/features/editor/ui/ModeSelector';
import type { EditorMode } from '@/features/editor/types';

interface ModeSelectorViewProps {
  documentId: string;
  currentMode: EditorMode | string;
  isOwnerOrCollaborator: boolean;
  onModeChange: (newMode: EditorMode) => Promise<void>;
}

export function ModeSelectorView({
  documentId,
  currentMode,
  isOwnerOrCollaborator,
  onModeChange,
}: ModeSelectorViewProps) {
  return (
    <EditorModeSelector
      entityType="amendment"
      entityId={documentId}
      currentMode={currentMode}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
      onModeChange={onModeChange}
    />
  );
}

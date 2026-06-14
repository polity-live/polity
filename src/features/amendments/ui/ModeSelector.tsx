'use client';

import { ModeSelector as EditorModeSelector } from '@/features/editor/ui/ModeSelector';
import type { EditorMode } from '@/features/editor/types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { toast } from 'sonner';

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
  const { t } = useTranslation();
  const { updateDocument } = useDocumentActions();

  const handleModeChange = async (newMode: EditorMode) => {
    await updateDocument({
      id: documentId,
      editing_mode: newMode,
    });

    toast.success(t('features.amendments.modeSelector.title'));
  };

  return (
    <EditorModeSelector
      entityType="amendment"
      entityId={documentId}
      currentMode={currentMode}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
      onModeChange={handleModeChange}
    />
  );
}

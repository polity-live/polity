import type { EditorMode } from '@/features/editor/types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';

interface UseModeSelectorControllerProps {
  documentId: string;
}

export function useModeSelectorController({ documentId }: UseModeSelectorControllerProps) {
  const { t } = useTranslation();
  const { updateDocument } = useDocumentActions();

  const handleModeChange = async (newMode: EditorMode) => {
    await updateDocument({
      id: documentId,
      editing_mode: newMode,
    });

    toast.success(t('features.amendments.modeSelector.title'));
  };

  return { handleModeChange };
}

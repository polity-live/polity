import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';

interface UseEditingModeSelectorControllerProps {
  amendmentId: string;
  currentMode?: string | null;
}

export function useEditingModeSelectorController({
  amendmentId,
  currentMode,
}: UseEditingModeSelectorControllerProps) {
  const { updateEditingMode } = useAmendmentActions();

  const handleModeChange = async (newMode: string) => {
    if (newMode === currentMode) return;
    await updateEditingMode(amendmentId, newMode);
  };

  return { handleModeChange };
}

import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { isEditingMode } from '@/zero/amendments/editing-mode-policy';

interface UseEditingModeSelectorControllerProps {
  processBranchId: string;
  currentMode?: string | null;
}

export function useEditingModeSelectorController({
  processBranchId,
  currentMode,
}: UseEditingModeSelectorControllerProps) {
  const { updateEditingMode } = useAmendmentActions();

  const handleModeChange = async (newMode: string) => {
    if (newMode === currentMode) return;
    if (!isEditingMode(newMode)) return;
    await updateEditingMode(processBranchId, newMode);
  };

  return { handleModeChange };
}

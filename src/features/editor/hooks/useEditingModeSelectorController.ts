import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import type { AutomaticEventEditingMode } from '@/zero/amendments/editing-mode-policy';

interface UseEditingModeSelectorControllerProps {
  processBranchId: string;
  currentMode?: AutomaticEventEditingMode | null;
}

export function useEditingModeSelectorController({
  processBranchId,
  currentMode,
}: UseEditingModeSelectorControllerProps) {
  const { updateEditingMode } = useAmendmentActions();

  const handleModeChange = async (newMode: AutomaticEventEditingMode) => {
    if (newMode === currentMode) return;
    await updateEditingMode(processBranchId, newMode);
  };

  return { handleModeChange };
}

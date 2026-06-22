'use client';

import { useEditingModeSelectorController } from '../hooks/useEditingModeSelectorController';
import { EditingModeSelectorView } from './EditingModeSelectorView';
import type { AutomaticEventEditingMode } from '@/zero/amendments/editing-mode-policy';

interface EditingModeSelectorProps {
  processBranchId: string;
  currentMode?: AutomaticEventEditingMode | null;
}

export function EditingModeSelector({ processBranchId, currentMode }: EditingModeSelectorProps) {
  const { handleModeChange } = useEditingModeSelectorController({ processBranchId, currentMode });

  return <EditingModeSelectorView currentMode={currentMode} onModeChange={handleModeChange} />;
}

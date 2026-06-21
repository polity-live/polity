'use client';

import { useEditingModeSelectorController } from '../hooks/useEditingModeSelectorController';
import { EditingModeSelectorView } from './EditingModeSelectorView';

interface EditingModeSelectorProps {
  processBranchId: string;
  currentMode?: string | null;
}

export function EditingModeSelector({ processBranchId, currentMode }: EditingModeSelectorProps) {
  const { handleModeChange } = useEditingModeSelectorController({ processBranchId, currentMode });

  return <EditingModeSelectorView currentMode={currentMode} onModeChange={handleModeChange} />;
}

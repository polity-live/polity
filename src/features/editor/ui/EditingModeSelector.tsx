'use client';

import { useEditingModeSelectorController } from '../hooks/useEditingModeSelectorController';
import { EditingModeSelectorView } from './EditingModeSelectorView';

interface EditingModeSelectorProps {
  amendmentId: string;
  currentMode?: string | null;
}

export function EditingModeSelector({ amendmentId, currentMode }: EditingModeSelectorProps) {
  const { handleModeChange } = useEditingModeSelectorController({ amendmentId, currentMode });

  return <EditingModeSelectorView currentMode={currentMode} onModeChange={handleModeChange} />;
}

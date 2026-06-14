import { useState } from 'react';

import type { EditorViewMode } from '../ui/EditorViewModeToggle';

interface ChangeRequestOption {
  id: string;
  crId: string;
  title: string;
  type: string;
}

interface UseEditorViewModeToggleControllerProps {
  mode: EditorViewMode;
  onModeChange: (mode: EditorViewMode) => void;
  selectedCRId: string | null;
  onSelectedCRChange: (crId: string | null) => void;
  changeRequests: ChangeRequestOption[];
}

export function useEditorViewModeToggleController({
  mode,
  onModeChange,
  selectedCRId,
  onSelectedCRChange,
  changeRequests,
}: UseEditorViewModeToggleControllerProps) {
  const [open, setOpen] = useState(false);
  const selectedCR = changeRequests.find(cr => cr.id === selectedCRId);

  const handleModeToggle = () => {
    if (mode === 'all') {
      onModeChange('single');
      if (!selectedCRId && changeRequests.length > 0) {
        onSelectedCRChange(changeRequests[0].id);
      }
    } else {
      onModeChange('all');
      onSelectedCRChange(null);
    }
  };

  const handleSelectCR = (crId: string) => {
    onSelectedCRChange(crId);
    onModeChange('single');
    setOpen(false);
  };

  return {
    open,
    selectedCR,
    onModeToggle: handleModeToggle,
    onOpenChange: setOpen,
    onSelectCR: handleSelectCR,
  };
}

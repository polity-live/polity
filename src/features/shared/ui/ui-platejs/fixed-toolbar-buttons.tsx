import { useEditorReadOnly } from 'platejs/react';
import { useTranslation } from 'react-i18next';

import { useModeContext } from '@/features/shared/ui/kit-platejs/mode-context.tsx';

interface FixedToolbarButtonsProps {
  className?: string;
  showModeToolbarButton?: boolean;
}
import { FixedToolbarButtonsView } from './FixedToolbarButtonsView';
export function FixedToolbarButtons({
  className,
  showModeToolbarButton = true,
}: FixedToolbarButtonsProps = {}) {
  const readOnly = useEditorReadOnly();
  const { t } = useTranslation();
  const { currentMode, onModeChange, isOwnerOrCollaborator } = useModeContext();
  return (
    <FixedToolbarButtonsView
      className={className}
      showModeToolbarButton={showModeToolbarButton}
      readOnly={readOnly}
      t={t}
      currentMode={currentMode}
      onModeChange={onModeChange}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
    />
  );
}

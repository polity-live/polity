import { type DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import type { EditorMode } from '@/features/editor/types';
import { useModeToolbarButtonController } from '@/features/shared/hooks/useModeToolbarButtonController';
import { ModeToolbarButtonView } from './ModeToolbarButtonView';

interface ModeToolbarButtonProps extends DropdownMenuProps {
  currentMode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
  isOwnerOrCollaborator?: boolean;
}

export function ModeToolbarButton({
  currentMode,
  onModeChange,
  isOwnerOrCollaborator = true,
  ...props
}: ModeToolbarButtonProps) {
  return (
    <ModeToolbarButtonView
      dropdownProps={props}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
      {...useModeToolbarButtonController({ currentMode, onModeChange })}
    />
  );
}

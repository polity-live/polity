import { type DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import type { EditorMode } from '@/features/editor/types';
import { useModeToolbarButtonController } from '@/features/shared/hooks/useModeToolbarButtonController';
import { ModeToolbarButtonView } from './ModeToolbarButtonView';

interface ModeToolbarButtonProps extends DropdownMenuProps {
  currentMode?: EditorMode;
  disabledModeReasons?: Partial<Record<EditorMode, string>>;
  onModeChange?: (mode: EditorMode) => void | Promise<void>;
  isOwnerOrCollaborator?: boolean;
  iconOnly?: boolean;
}

export function ModeToolbarButton({
  currentMode,
  disabledModeReasons,
  onModeChange,
  isOwnerOrCollaborator = true,
  iconOnly = false,
  ...props
}: ModeToolbarButtonProps) {
  return (
    <ModeToolbarButtonView
      dropdownProps={props}
      disabledModeReasons={disabledModeReasons}
      iconOnly={iconOnly}
      isOwnerOrCollaborator={isOwnerOrCollaborator}
      {...useModeToolbarButtonController({ currentMode, onModeChange })}
    />
  );
}

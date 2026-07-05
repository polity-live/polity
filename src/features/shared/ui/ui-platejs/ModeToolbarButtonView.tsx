import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import type { EditorMode } from '@/features/editor/types';
import { ToolbarButton } from '@/features/shared/ui/layout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { EditingModeMenuItems, type SelectableEditingMode } from '@/features/shared/ui/status';

interface ModeToolbarButtonViewProps {
  dropdownProps: DropdownMenuProps;
  disabledModeReasons?: Partial<Record<EditorMode, string>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SelectableEditingMode;
  currentOption: ReturnType<typeof import('@/features/shared/ui/status').getEditingModeOption>;
  iconOnly?: boolean;
  labels: {
    editingMode: string;
    viewOnly: string;
  };
  isOwnerOrCollaborator: boolean;
  onModeChange: (mode: SelectableEditingMode) => void | Promise<void>;
}

export function ModeToolbarButtonView({
  dropdownProps,
  disabledModeReasons,
  open,
  onOpenChange,
  mode,
  currentOption,
  iconOnly = false,
  labels,
  isOwnerOrCollaborator,
  onModeChange,
}: ModeToolbarButtonViewProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false} {...dropdownProps}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          key={mode}
          aria-label={currentOption.label}
          pressed={open}
          tooltip={labels.editingMode}
          isDropdown={!iconOnly}
        >
          <currentOption.Icon />
          <span className={iconOnly ? 'sr-only' : 'hidden lg:inline'}>{currentOption.label}</span>
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80" align="start">
        {!isOwnerOrCollaborator && (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">{labels.viewOnly}</div>
        )}
        <EditingModeMenuItems
          value={mode}
          disabled={!isOwnerOrCollaborator}
          disabledModeReasons={disabledModeReasons}
          onValueChange={onModeChange}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

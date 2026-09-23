import { useState } from 'react';
import { ToolbarButton } from '@/features/shared/ui/layout';
import { Button } from '@/features/shared/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  EditingModeMenuItems,
  getEditingModeOption,
  type SelectableEditingMode,
} from './EditingMode';

export function EditingModeToolbarButton({
  'data-action-id': actionId,
  availableModes,
  canChangeMode,
  disabledModeReasons,
  mode,
  onModeChange,
  standalone = false,
  showLabel = false,
}: {
  'data-action-id': string;
  availableModes?: readonly SelectableEditingMode[];
  canChangeMode: boolean;
  disabledModeReasons: Partial<Record<SelectableEditingMode, string>>;
  mode: SelectableEditingMode;
  onModeChange: (mode: SelectableEditingMode) => void | Promise<void>;
  standalone?: boolean;
  showLabel?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentOption = getEditingModeOption(mode, t);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        {standalone ? (
          <Button
            data-action-id={actionId}
            type="button"
            variant="outline"
            size="sm"
            aria-label={currentOption.label}
            aria-expanded={open}
          >
            <currentOption.Icon className="size-4" />
          </Button>
        ) : (
          <ToolbarButton
            data-action-id={actionId}
            type="button"
            aria-label={currentOption.label}
            pressed={open}
            isDropdown={showLabel}
            tooltip={t('plateJs.toolbar.editingMode')}
          >
            <currentOption.Icon className="size-4" />
            {showLabel && <span className="hidden lg:inline">{currentOption.label}</span>}
          </ToolbarButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {!canChangeMode && (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">
            {t('plateJs.toolbar.mode.viewOnly')}
          </div>
        )}
        <EditingModeMenuItems
          modes={availableModes}
          showAutomaticEventModes={!availableModes}
          value={mode}
          disabled={!canChangeMode}
          disabledModeReasons={disabledModeReasons}
          onValueChange={nextMode => {
            void onModeChange(nextMode);
            setOpen(false);
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

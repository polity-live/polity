import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { DropdownMenuItemIndicator } from '@radix-ui/react-dropdown-menu';
import { CheckIcon } from 'lucide-react';

import type { TurnIntoItem } from '@/features/shared/hooks/useTurnIntoToolbarButtonController';

import { ToolbarButton, ToolbarMenuGroup } from '@/features/shared/ui/layout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';

interface TurnIntoToolbarButtonViewProps {
  dropdownProps: DropdownMenuProps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  selectedItem: TurnIntoItem;
  turnIntoItems: TurnIntoItem[];
  labels: {
    turnInto: string;
  };
  onCloseAutoFocus: (event: Event) => void;
  onValueChange: (type: string) => void;
}

export function TurnIntoToolbarButtonView({
  dropdownProps,
  open,
  onOpenChange,
  value,
  selectedItem,
  turnIntoItems,
  labels,
  onCloseAutoFocus,
  onValueChange,
}: TurnIntoToolbarButtonViewProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false} {...dropdownProps}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className="min-w-[125px]"
          pressed={open}
          tooltip={labels.turnInto}
          isDropdown
        >
          {selectedItem.label}
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="ignore-click-outside/toolbar min-w-0"
        onCloseAutoFocus={onCloseAutoFocus}
        align="start"
      >
        <ToolbarMenuGroup value={value} onValueChange={onValueChange} label={labels.turnInto}>
          {turnIntoItems.map(({ Icon, label, value: itemValue }) => (
            <DropdownMenuRadioItem
              key={itemValue}
              className="min-w-[180px] pl-2 *:first:[span]:hidden"
              value={itemValue}
            >
              <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
                <DropdownMenuItemIndicator>
                  <CheckIcon />
                </DropdownMenuItemIndicator>
              </span>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </ToolbarMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

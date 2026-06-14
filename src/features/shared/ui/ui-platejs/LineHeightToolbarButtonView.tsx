import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import { DropdownMenuItemIndicator } from '@radix-ui/react-dropdown-menu';
import { CheckIcon, WrapText } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { ToolbarButton } from '@/features/shared/ui/layout';

interface LineHeightToolbarButtonViewProps {
  dropdownProps: DropdownMenuProps;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: string;
  values: string[];
  onValueChange: (value: string) => void;
}

export function LineHeightToolbarButtonView({
  dropdownProps,
  label,
  open,
  onOpenChange,
  value,
  values,
  onValueChange,
}: LineHeightToolbarButtonViewProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false} {...dropdownProps}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip={label} isDropdown>
          <WrapText />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-0" align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {values.map((value: any) => (
            <DropdownMenuRadioItem
              key={value}
              className="min-w-[180px] pl-2 *:first:[span]:hidden"
              value={value}
            >
              <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
                <DropdownMenuItemIndicator>
                  <CheckIcon />
                </DropdownMenuItemIndicator>
              </span>
              {value}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

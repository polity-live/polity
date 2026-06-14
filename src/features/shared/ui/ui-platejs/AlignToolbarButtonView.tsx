import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import { AlignCenterIcon, AlignJustifyIcon, AlignLeftIcon, AlignRightIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { ToolbarButton } from '@/features/shared/ui/layout';

const items = [
  {
    icon: AlignLeftIcon,
    value: 'left',
  },
  {
    icon: AlignCenterIcon,
    value: 'center',
  },
  {
    icon: AlignRightIcon,
    value: 'right',
  },
  {
    icon: AlignJustifyIcon,
    value: 'justify',
  },
];

interface AlignToolbarButtonViewProps {
  dropdownProps: DropdownMenuProps;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
}

export function AlignToolbarButtonView({
  dropdownProps,
  label,
  open,
  onOpenChange,
  value,
  onValueChange,
}: AlignToolbarButtonViewProps) {
  const IconValue = items.find(item => item.value === value)?.icon ?? AlignLeftIcon;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false} {...dropdownProps}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip={label} isDropdown>
          <IconValue />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-0" align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {items.map(({ icon: Icon, value: itemValue }) => (
            <DropdownMenuRadioItem
              key={itemValue}
              className="data-[state=checked]:bg-success data-[state=checked]:text-success-foreground pl-2 *:first:[span]:hidden"
              value={itemValue}
            >
              <Icon />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

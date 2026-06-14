import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import { KeyboardIcon, MoreHorizontalIcon, SubscriptIcon, SuperscriptIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { ToolbarButton } from '@/features/shared/ui/layout';

interface MoreToolbarButtonViewProps {
  dropdownProps: DropdownMenuProps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: {
    more: string;
    keyboardInput: string;
    superscript: string;
    subscript: string;
  };
  onKeyboardInput: () => void;
  onSuperscript: () => void;
  onSubscript: () => void;
}

export function MoreToolbarButtonView({
  dropdownProps,
  open,
  onOpenChange,
  labels,
  onKeyboardInput,
  onSuperscript,
  onSubscript,
}: MoreToolbarButtonViewProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false} {...dropdownProps}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip={labels.more}>
          <MoreHorizontalIcon />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="ignore-click-outside/toolbar flex max-h-[500px] min-w-[180px] flex-col overflow-y-auto"
        align="start"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onKeyboardInput}>
            <KeyboardIcon />
            {labels.keyboardInput}
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={onSuperscript}>
            <SuperscriptIcon />
            {labels.superscript}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSubscript}>
            <SubscriptIcon />
            {labels.subscript}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

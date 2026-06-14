import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import { ArrowUpToLineIcon } from 'lucide-react';

import { ToolbarButton } from '@/features/shared/ui/layout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';

interface ImportToolbarButtonViewProps {
  dropdownProps: DropdownMenuProps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: {
    import: string;
    importFromHTML: string;
    importFromMarkdown: string;
  };
  onOpenHtmlFilePicker: () => void;
  onOpenMarkdownFilePicker: () => void;
}

export function ImportToolbarButtonView({
  dropdownProps,
  open,
  onOpenChange,
  labels,
  onOpenHtmlFilePicker,
  onOpenMarkdownFilePicker,
}: ImportToolbarButtonViewProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false} {...dropdownProps}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip={labels.import} isDropdown>
          <ArrowUpToLineIcon className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onOpenHtmlFilePicker}>
            {labels.importFromHTML}
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={onOpenMarkdownFilePicker}>
            {labels.importFromMarkdown}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

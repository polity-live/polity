import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import { ArrowDownToLineIcon } from 'lucide-react';

import { ToolbarButton } from '@/features/shared/ui/layout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';

interface ExportToolbarButtonViewProps extends DropdownMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: {
    export: string;
    html: string;
    pdf: string;
    image: string;
    markdown: string;
    word: string;
  };
  exportToHtml: () => Promise<void>;
  exportToPdf: () => Promise<void>;
  exportToImage: () => Promise<void>;
  exportToMarkdown: () => Promise<void>;
  exportToWord: () => Promise<void>;
}

export function ExportToolbarButtonView({
  open,
  onOpenChange,
  labels,
  exportToHtml,
  exportToPdf,
  exportToImage,
  exportToMarkdown,
  exportToWord,
  ...props
}: ExportToolbarButtonViewProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip={labels.export} isDropdown>
          <ArrowDownToLineIcon className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={exportToHtml}>{labels.html}</DropdownMenuItem>
          <DropdownMenuItem onSelect={exportToPdf}>{labels.pdf}</DropdownMenuItem>
          <DropdownMenuItem onSelect={exportToImage}>{labels.image}</DropdownMenuItem>
          <DropdownMenuItem onSelect={exportToMarkdown}>{labels.markdown}</DropdownMenuItem>
          <DropdownMenuItem onSelect={exportToWord}>{labels.word}</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

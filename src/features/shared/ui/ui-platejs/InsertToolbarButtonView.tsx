import * as React from 'react';
import { PlusIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { ToolbarButton, ToolbarMenuGroup } from '@/features/shared/ui/layout';
export interface InsertToolbarButtonViewProps {
  props: any;
  editor: any;
  t: any;
  open: any;
  setOpen: any;
  groupsList: any;
}

export function InsertToolbarButtonView({
  props,
  editor,
  t,
  open,
  setOpen,
  groupsList,
}: InsertToolbarButtonViewProps) {
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip={t('plateJs.toolbar.insert')} isDropdown>
          <PlusIcon />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="flex max-h-[500px] min-w-0 flex-col overflow-y-auto"
        align="start"
      >
        {groupsList.map(({ group, items: nestedItems }: any) => (
          <ToolbarMenuGroup key={group} label={group}>
            {nestedItems.map(({ focusEditor, icon, label, value, onSelect }: any) => (
              <DropdownMenuItem
                key={value}
                className="min-w-[180px]"
                onSelect={() => {
                  onSelect(editor, value);
                  if (focusEditor !== false) editor.tf.focus();
                }}
              >
                {icon}
                {label}
              </DropdownMenuItem>
            ))}
          </ToolbarMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

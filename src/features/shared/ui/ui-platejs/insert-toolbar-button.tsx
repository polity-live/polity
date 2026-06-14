import * as React from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import type { TFunction } from 'i18next';

import {
  CalendarIcon,
  ChartNoAxesCombinedIcon,
  ChevronRightIcon,
  Columns3Icon,
  FileCodeIcon,
  FilmIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
  RadicalIcon,
  SquareIcon,
  TableIcon,
  TableOfContentsIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { type PlateEditor, useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { insertBlock, insertInlineElement } from '@/features/shared/ui/kit-platejs/transforms.ts';

import { ToolbarButton, ToolbarMenuGroup } from '@/features/shared/ui/ui/toolbar.tsx';
import { CHART_NODE_TYPE } from '@/features/charts/types';
import { openChartDialog } from '@/features/charts/ui/ChartDialog';

interface Group {
  group: string;
  items: Item[];
}

interface Item {
  icon: React.ReactNode;
  value: string;
  onSelect: (editor: PlateEditor, value: string) => void;
  focusEditor?: boolean;
  label?: string;
}

const groups = (t: TFunction): Group[] => [
  {
    group: t('plateJs.toolbar.groups.basicBlocks'),
    items: [
      {
        icon: <PilcrowIcon />,
        label: t('plateJs.text'),
        value: KEYS.p,
      },
      {
        icon: <Heading1Icon />,
        label: t('plateJs.headings.heading1'),
        value: 'h1',
      },
      {
        icon: <Heading2Icon />,
        label: t('plateJs.headings.heading2'),
        value: 'h2',
      },
      {
        icon: <Heading3Icon />,
        label: t('plateJs.headings.heading3'),
        value: 'h3',
      },
      {
        icon: <TableIcon />,
        label: t('plateJs.toolbar.tableButton'),
        value: KEYS.table,
      },
      {
        icon: <FileCodeIcon />,
        label: t('plateJs.code'),
        value: KEYS.codeBlock,
      },
      {
        icon: <QuoteIcon />,
        label: t('plateJs.quote'),
        value: KEYS.blockquote,
      },
      {
        icon: <MinusIcon />,
        label: t('plateJs.toolbar.divider'),
        value: KEYS.hr,
      },
    ].map(item => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value);
      },
    })),
  },
  {
    group: t('plateJs.toolbar.groups.lists'),
    items: [
      {
        icon: <ListIcon />,
        label: t('plateJs.toolbar.bulletedList'),
        value: KEYS.ul,
      },
      {
        icon: <ListOrderedIcon />,
        label: t('plateJs.toolbar.numberedList'),
        value: KEYS.ol,
      },
      {
        icon: <SquareIcon />,
        label: t('plateJs.toolbar.todoList'),
        value: KEYS.listTodo,
      },
      {
        icon: <ChevronRightIcon />,
        label: t('plateJs.toolbar.toggleList'),
        value: KEYS.toggle,
      },
    ].map(item => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value);
      },
    })),
  },
  {
    group: t('plateJs.toolbar.groups.media'),
    items: [
      ...[
        {
          icon: <ImageIcon />,
          label: t('plateJs.toolbar.image'),
          value: KEYS.img,
        },
        {
          icon: <FilmIcon />,
          label: t('plateJs.toolbar.embed'),
          value: KEYS.mediaEmbed,
        },
      ].map(item => ({
        ...item,
        onSelect: (editor: PlateEditor, value: string) => {
          insertBlock(editor, value);
        },
      })),
      {
        focusEditor: false,
        icon: <ChartNoAxesCombinedIcon />,
        label: t('plateJs.toolbar.chart'),
        value: CHART_NODE_TYPE,
        onSelect: () => openChartDialog(),
      },
    ],
  },
  {
    group: t('plateJs.toolbar.groups.advancedBlocks'),
    items: [
      {
        icon: <TableOfContentsIcon />,
        label: t('plateJs.toolbar.tableOfContents.title'),
        value: KEYS.toc,
      },
      {
        icon: <Columns3Icon />,
        label: t('plateJs.layout.threeColumns'),
        value: 'action_three_columns',
      },
      {
        focusEditor: false,
        icon: <RadicalIcon />,
        label: t('plateJs.toolbar.equation'),
        value: KEYS.equation,
      },
    ].map(item => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value);
      },
    })),
  },
  {
    group: t('plateJs.toolbar.groups.inline'),
    items: [
      {
        icon: <Link2Icon />,
        label: t('plateJs.toolbar.link'),
        value: KEYS.link,
      },
      {
        focusEditor: true,
        icon: <CalendarIcon />,
        label: t('plateJs.toolbar.date'),
        value: KEYS.date,
      },
      {
        focusEditor: false,
        icon: <RadicalIcon />,
        label: t('plateJs.toolbar.inlineEquation'),
        value: KEYS.inlineEquation,
      },
    ].map(item => ({
      ...item,
      onSelect: (editor, value) => {
        insertInlineElement(editor, value);
      },
    })),
  },
];

export function InsertToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const groupsList = groups(t);

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
        {groupsList.map(({ group, items: nestedItems }) => (
          <ToolbarMenuGroup key={group} label={group}>
            {nestedItems.map(({ focusEditor, icon, label, value, onSelect }) => (
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

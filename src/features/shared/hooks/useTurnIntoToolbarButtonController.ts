import type { TFunction } from 'i18next';
import type { TElement } from 'platejs';

import {
  ChevronRightIcon,
  Columns3Icon,
  FileCodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  QuoteIcon,
  SquareIcon,
  type LucideIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorRef, useSelectionFragmentProp } from 'platejs/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getBlockType, setBlockType } from '@/features/shared/ui/kit-platejs/transforms.ts';

export interface TurnIntoItem {
  Icon: LucideIcon;
  keywords?: string[];
  label: string;
  value: string;
}

const createTurnIntoItems = (t: TFunction): TurnIntoItem[] => [
  {
    Icon: PilcrowIcon,
    keywords: ['paragraph'],
    label: t('plateJs.text'),
    value: KEYS.p,
  },
  {
    Icon: Heading1Icon,
    keywords: ['title', 'h1'],
    label: t('plateJs.headings.heading1'),
    value: 'h1',
  },
  {
    Icon: Heading2Icon,
    keywords: ['subtitle', 'h2'],
    label: t('plateJs.headings.heading2'),
    value: 'h2',
  },
  {
    Icon: Heading3Icon,
    keywords: ['subtitle', 'h3'],
    label: t('plateJs.headings.heading3'),
    value: 'h3',
  },
  {
    Icon: ListIcon,
    keywords: ['unordered', 'ul', '-'],
    label: t('plateJs.lists.bulleted'),
    value: KEYS.ul,
  },
  {
    Icon: ListOrderedIcon,
    keywords: ['ordered', 'ol', '1'],
    label: t('plateJs.lists.numbered'),
    value: KEYS.ol,
  },
  {
    Icon: SquareIcon,
    keywords: ['checklist', 'task', 'checkbox', '[]'],
    label: t('plateJs.lists.todo'),
    value: KEYS.listTodo,
  },
  {
    Icon: ChevronRightIcon,
    keywords: ['collapsible', 'expandable'],
    label: t('plateJs.lists.toggle'),
    value: KEYS.toggle,
  },
  {
    Icon: FileCodeIcon,
    keywords: ['```'],
    label: t('plateJs.code'),
    value: KEYS.codeBlock,
  },
  {
    Icon: QuoteIcon,
    keywords: ['citation', 'blockquote', '>'],
    label: t('plateJs.quote'),
    value: KEYS.blockquote,
  },
  {
    Icon: Columns3Icon,
    label: t('plateJs.layout.threeColumns'),
    value: 'action_three_columns',
  },
];

export function useTurnIntoToolbarButtonController() {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const turnIntoItems = useMemo(() => createTurnIntoItems(t), [t]);
  const value = useSelectionFragmentProp({
    defaultValue: KEYS.p,
    getProp: node => getBlockType(node as TElement),
  });
  const selectedValue = value ?? KEYS.p;
  const selectedItem = useMemo(
    () => turnIntoItems.find(item => item.value === selectedValue) ?? turnIntoItems[0],
    [selectedValue, turnIntoItems]
  );

  const handleCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    editor.tf.focus();
  };

  const handleValueChange = (type: string) => {
    setBlockType(editor, type);
  };

  return {
    open,
    onOpenChange: setOpen,
    value: selectedValue,
    selectedItem,
    turnIntoItems,
    labels: {
      turnInto: t('plateJs.toolbar.turnInto'),
    },
    onCloseAutoFocus: handleCloseAutoFocus,
    onValueChange: handleValueChange,
  };
}

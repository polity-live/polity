import * as React from 'react';

import type { PlateEditor, PlateElementProps } from 'platejs/react';

import { AIChatPlugin } from '@platejs/ai/react';
import { useTranslation } from 'react-i18next';
import {
  CalendarIcon,
  DatabaseIcon,
  ChevronRightIcon,
  Code2,
  Columns3Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  LightbulbIcon,
  ListIcon,
  ListOrdered,
  PilcrowIcon,
  Quote,
  RadicalIcon,
  SparklesIcon,
  Square,
  Table,
  TableOfContentsIcon,
} from 'lucide-react';
import { type TComboboxInputElement, KEYS } from 'platejs';
import { PlateElement } from 'platejs/react';

import { insertBlock, insertInlineElement } from '@/features/shared/ui/kit-platejs/transforms.ts';
import { DATA_VIEW_NODE_TYPE } from '@/features/charts/types';
import { openDataViewDialog } from '@/features/charts/ui/ChartDialog';

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from '@/features/shared/ui/rich-text';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type GroupName = 'advancedBlocks' | 'ai' | 'basicBlocks' | 'inline';

interface Group {
  group: GroupName;
  items: {
    icon: React.ReactNode;
    value: string;
    onSelect: (editor: PlateEditor, value: string) => void;
    className?: string;
    focusEditor?: boolean;
    keywords?: string[];
  }[];
}

const groupTranslationKeys: Record<GroupName, string> = {
  advancedBlocks: 'plateJs.toolbar.groups.advancedBlocks',
  ai: 'plateJs.toolbar.groups.ai',
  basicBlocks: 'plateJs.toolbar.groups.basicBlocks',
  inline: 'plateJs.toolbar.groups.inline',
};

const groups: Group[] = [
  {
    group: 'ai',
    items: [
      {
        focusEditor: false,
        icon: <SparklesIcon />,
        value: 'AI',
        onSelect: editor => {
          editor.getApi(AIChatPlugin).aiChat.show();
        },
      },
    ],
  },
  {
    group: 'basicBlocks',
    items: [
      {
        icon: <PilcrowIcon />,
        keywords: ['paragraph'],
        value: KEYS.p,
      },
      {
        icon: <Heading1Icon />,
        keywords: ['title', 'h1'],
        value: KEYS.h1,
      },
      {
        icon: <Heading2Icon />,
        keywords: ['subtitle', 'h2'],
        value: KEYS.h2,
      },
      {
        icon: <Heading3Icon />,
        keywords: ['subtitle', 'h3'],
        value: KEYS.h3,
      },
      {
        icon: <ListIcon />,
        keywords: ['unordered', 'ul', '-'],
        value: KEYS.ul,
      },
      {
        icon: <ListOrdered />,
        keywords: ['ordered', 'ol', '1'],
        value: KEYS.ol,
      },
      {
        icon: <Square />,
        keywords: ['checklist', 'task', 'checkbox', '[]'],
        value: KEYS.listTodo,
      },
      {
        icon: <ChevronRightIcon />,
        keywords: ['collapsible', 'expandable'],
        value: KEYS.toggle,
      },
      {
        icon: <Code2 />,
        keywords: ['```'],
        value: KEYS.codeBlock,
      },
      {
        icon: <Table />,
        value: KEYS.table,
      },
      {
        icon: <Quote />,
        keywords: ['citation', 'blockquote', 'quote', '>'],
        value: KEYS.blockquote,
      },
      {
        description: translateText('generated.inline.0528_insert_a_highlighted_block_0dccdad4'),
        icon: <LightbulbIcon />,
        keywords: ['note'],
        value: KEYS.callout,
      },
    ].map(item => ({
      ...item,
      onSelect: (editor, value) => {
        insertBlock(editor, value);
      },
    })),
  },
  {
    group: 'advancedBlocks',
    items: [
      ...[
        {
          icon: <TableOfContentsIcon />,
          keywords: ['toc'],
          value: KEYS.toc,
        },
        {
          icon: <Columns3Icon />,
          value: 'action_three_columns',
        },
        {
          focusEditor: false,
          icon: <RadicalIcon />,
          value: KEYS.equation,
        },
      ].map(item => ({
        ...item,
        onSelect: (editor: PlateEditor, value: string) => {
          insertBlock(editor, value);
        },
      })),
      {
        focusEditor: false,
        icon: <DatabaseIcon />,
        keywords: ['graph', 'diagram', 'csv', 'govdata', 'eurostat'],
        value: DATA_VIEW_NODE_TYPE,
        onSelect: () => openDataViewDialog(),
      },
    ],
  },
  {
    group: 'inline',
    items: [
      {
        focusEditor: true,
        icon: <CalendarIcon />,
        keywords: ['time'],
        value: KEYS.date,
      },
      {
        focusEditor: false,
        icon: <RadicalIcon />,
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

const itemTranslationKeys: Record<string, string> = {
  AI: 'plateJs.toolbar.askAI',
  [DATA_VIEW_NODE_TYPE]: 'plateJs.dataView.insertTitle',
  [KEYS.blockquote]: 'plateJs.quote',
  [KEYS.callout]: 'plateJs.layout.callout',
  [KEYS.codeBlock]: 'plateJs.code',
  [KEYS.date]: 'plateJs.toolbar.date',
  [KEYS.equation]: 'plateJs.equation.newEquation',
  [KEYS.h1]: 'plateJs.headings.heading1',
  [KEYS.h2]: 'plateJs.headings.heading2',
  [KEYS.h3]: 'plateJs.headings.heading3',
  [KEYS.inlineEquation]: 'plateJs.toolbar.inlineEquation',
  [KEYS.listTodo]: 'plateJs.lists.todo',
  [KEYS.ol]: 'plateJs.lists.numbered',
  [KEYS.p]: 'plateJs.text',
  [KEYS.table]: 'plateJs.toolbar.tableButton',
  [KEYS.toc]: 'plateJs.toolbar.tableOfContents.title',
  [KEYS.toggle]: 'plateJs.lists.toggle',
  [KEYS.ul]: 'plateJs.lists.bulleted',
  action_three_columns: 'plateJs.layout.threeColumns',
};

export function SlashInputElement(props: PlateElementProps<TComboboxInputElement>) {
  const { editor, element } = props;
  const { t } = useTranslation();

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox element={element} trigger="/">
        <InlineComboboxInput />

        <InlineComboboxContent>
          <InlineComboboxEmpty>{t('commandDialog.noResults')}</InlineComboboxEmpty>

          {groups.map(({ group, items }) => {
            return (
              <InlineComboboxGroup key={group}>
                <InlineComboboxGroupLabel>
                  {t(groupTranslationKeys[group], { defaultValue: group })}
                </InlineComboboxGroupLabel>

                {items.map(({ focusEditor, icon, keywords, value, onSelect }) => {
                  const translatedLabel = t(itemTranslationKeys[value], { defaultValue: value });

                  return (
                    <InlineComboboxItem
                      key={value}
                      value={value}
                      onClick={() => onSelect(editor, value)}
                      label={translatedLabel}
                      focusEditor={focusEditor}
                      group={group}
                      keywords={keywords}
                    >
                      <div className="text-muted-foreground mr-2">{icon}</div>
                      {translatedLabel}
                    </InlineComboboxItem>
                  );
                })}
              </InlineComboboxGroup>
            );
          })}
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}

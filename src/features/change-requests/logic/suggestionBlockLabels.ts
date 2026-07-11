import { KEYS } from 'platejs';

import { DATA_VIEW_NODE_TYPE } from '@/features/charts/types';

export const BLOCK_SUGGESTION_MARKER = '__block__';

interface BlockLabelNode {
  type?: string;
  view?: string;
  [key: string]: unknown;
}

export function getSuggestionBlockLabel(node: BlockLabelNode): string {
  if (node.type === DATA_VIEW_NODE_TYPE) {
    switch (node.view) {
      case 'chart':
        return 'Chart';
      case 'table':
        return 'Table';
      case 'stat':
        return 'Metric';
      default:
        return 'Data';
    }
  }

  if (node.type === KEYS.p) {
    if (node[KEYS.listType] === KEYS.listTodo) return 'Todo list';
    if (node[KEYS.listType] === KEYS.ol) return 'Numbered list';
    if (node[KEYS.listType] === KEYS.ul) return 'Bulleted list';
  }

  switch (node.type) {
    case KEYS.audio:
      return 'Audio';
    case KEYS.blockquote:
      return 'Quote';
    case KEYS.callout:
      return 'Callout';
    case KEYS.codeBlock:
      return 'Code';
    case KEYS.column:
      return 'Column';
    case KEYS.columnGroup:
      return '3 columns';
    case KEYS.date:
      return 'Date';
    case KEYS.equation:
      return 'Equation';
    case KEYS.file:
      return 'File';
    case KEYS.h1:
      return 'Heading 1';
    case KEYS.h2:
      return 'Heading 2';
    case KEYS.h3:
      return 'Heading 3';
    case KEYS.h4:
      return 'Heading 4';
    case KEYS.h5:
      return 'Heading 5';
    case KEYS.h6:
      return 'Heading 6';
    case KEYS.hr:
      return 'Divider';
    case KEYS.img:
      return 'Image';
    case KEYS.inlineEquation:
      return 'Inline equation';
    case KEYS.link:
      return 'Link';
    case KEYS.mediaEmbed:
      return 'Embed';
    case KEYS.p:
      return 'Text';
    case KEYS.table:
      return 'Table';
    case KEYS.toc:
      return 'Table of contents';
    case KEYS.toggle:
      return 'Toggle';
    case KEYS.video:
      return 'Video';
    default:
      return 'Block';
  }
}

export function appendSuggestionBlockLabel(value: string, label: string): string {
  return `${value}${BLOCK_SUGGESTION_MARKER}${label}`;
}

export function appendSuggestionLineBreak(value: string): string {
  return `${value}${BLOCK_SUGGESTION_MARKER}`;
}

export function splitSuggestionPreviewText(value: string, lineBreakLabel?: string): string[] {
  if (!value.includes(BLOCK_SUGGESTION_MARKER)) return [value];
  if (value === BLOCK_SUGGESTION_MARKER) return lineBreakLabel ? [lineBreakLabel] : [];

  const parts = value.split(BLOCK_SUGGESTION_MARKER);
  const split = parts
    .map(part => (part ? part : lineBreakLabel))
    .filter((part): part is string => Boolean(part));

  return split.length > 0 ? split : lineBreakLabel ? [lineBreakLabel] : [];
}

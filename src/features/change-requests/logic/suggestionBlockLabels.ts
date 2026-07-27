import { KEYS } from 'platejs';

import { DATA_VIEW_NODE_TYPE } from '@/features/charts/types';
import { translate } from '@/features/shared/hooks/use-translation';

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
        return translate('features.changeRequests.blockLabels.chart');
      case 'table':
        return translate('features.changeRequests.blockLabels.table');
      case 'stat':
        return translate('features.changeRequests.blockLabels.metric');
      default:
        return translate('features.changeRequests.blockLabels.data');
    }
  }

  if (node.type === KEYS.p) {
    if (node[KEYS.listType] === KEYS.listTodo)
      return translate('features.changeRequests.blockLabels.todoList');
    if (node[KEYS.listType] === KEYS.ol)
      return translate('features.changeRequests.blockLabels.numberedList');
    if (node[KEYS.listType] === KEYS.ul)
      return translate('features.changeRequests.blockLabels.bulletedList');
  }

  switch (node.type) {
    case KEYS.audio:
      return translate('features.changeRequests.blockLabels.audio');
    case KEYS.blockquote:
      return translate('features.changeRequests.blockLabels.quote');
    case KEYS.callout:
      return translate('features.changeRequests.blockLabels.callout');
    case KEYS.codeBlock:
      return translate('features.changeRequests.blockLabels.code');
    case KEYS.column:
      return translate('features.changeRequests.blockLabels.column');
    case KEYS.columnGroup:
      return translate('features.changeRequests.blockLabels.columns');
    case KEYS.date:
      return translate('features.changeRequests.blockLabels.date');
    case KEYS.equation:
      return translate('features.changeRequests.blockLabels.equation');
    case KEYS.file:
      return translate('features.changeRequests.blockLabels.file');
    case KEYS.h1:
      return translate('features.changeRequests.blockLabels.heading1');
    case KEYS.h2:
      return translate('features.changeRequests.blockLabels.heading2');
    case KEYS.h3:
      return translate('features.changeRequests.blockLabels.heading3');
    case KEYS.h4:
      return translate('features.changeRequests.blockLabels.heading4');
    case KEYS.h5:
      return translate('features.changeRequests.blockLabels.heading5');
    case KEYS.h6:
      return translate('features.changeRequests.blockLabels.heading6');
    case KEYS.hr:
      return translate('features.changeRequests.blockLabels.divider');
    case KEYS.img:
      return translate('features.changeRequests.blockLabels.image');
    case KEYS.inlineEquation:
      return translate('features.changeRequests.blockLabels.inlineEquation');
    case KEYS.link:
      return translate('features.changeRequests.blockLabels.link');
    case KEYS.mediaEmbed:
      return translate('features.changeRequests.blockLabels.embed');
    case KEYS.p:
      return translate('features.changeRequests.blockLabels.text');
    case KEYS.table:
      return translate('features.changeRequests.blockLabels.table');
    case KEYS.toc:
      return translate('features.changeRequests.blockLabels.tableOfContents');
    case KEYS.toggle:
      return translate('features.changeRequests.blockLabels.toggle');
    case KEYS.video:
      return translate('features.changeRequests.blockLabels.video');
    default:
      return translate('features.changeRequests.blockLabels.block');
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

import { toMutableJSONValue, type MutableJSONValue } from '@/zero/shared/helpers';
import type { Descendant, Value } from 'platejs';

export const EMPTY_RICH_TEXT_VALUE: Value = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeNode(node: unknown): Descendant {
  if (!isRecord(node)) {
    return { text: '' };
  }

  if (typeof node.text === 'string') {
    return node as Descendant;
  }

  const children = Array.isArray(node.children) ? node.children.map(sanitizeNode) : [{ text: '' }];

  return {
    ...node,
    children: children.length > 0 ? children : [{ text: '' }],
  } as Descendant;
}

function sanitizeElement(node: unknown): Value[number] {
  const sanitizedNode = sanitizeNode(node);

  if (isRecord(sanitizedNode) && Array.isArray(sanitizedNode.children)) {
    return sanitizedNode as Value[number];
  }

  return {
    type: 'p',
    children: [sanitizedNode],
  };
}

function parseStructuredRichText(value: unknown): Value | null {
  if (Array.isArray(value)) {
    return value.map(sanitizeElement);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(sanitizeElement);
      }
    } catch {
      return null;
    }
  }

  return null;
}

function plainTextToRichText(text: string): Value {
  const normalized = text.replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    return EMPTY_RICH_TEXT_VALUE;
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return EMPTY_RICH_TEXT_VALUE;
  }

  return blocks.map(block => ({
    type: 'p',
    children: [{ text: block }],
  }));
}

function extractText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractText).join('\n');
  }

  if (!isRecord(value)) {
    return '';
  }

  if (typeof value.text === 'string') {
    return value.text;
  }

  if (Array.isArray(value.children)) {
    return value.children.map(extractText).join('');
  }

  return '';
}

export function toRichTextValue(value: unknown): Value {
  const structuredValue = parseStructuredRichText(value);

  if (structuredValue) {
    return structuredValue.length > 0 ? structuredValue : EMPTY_RICH_TEXT_VALUE;
  }

  if (typeof value === 'string') {
    return plainTextToRichText(value);
  }

  return EMPTY_RICH_TEXT_VALUE;
}

export function richTextToPlainText(value: unknown): string {
  const structuredValue = parseStructuredRichText(value);

  if (structuredValue) {
    return extractText(structuredValue)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return '';
}

export function hasRichTextContent(value: unknown): boolean {
  return richTextToPlainText(value).length > 0;
}

export function toZeroRichTextValue(value: Value): MutableJSONValue {
  return toMutableJSONValue(value);
}

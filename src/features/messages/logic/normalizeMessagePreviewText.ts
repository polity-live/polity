import { richTextToPlainText } from '@/features/shared/logic/richText';

export function normalizeMessagePreviewText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  const text = richTextToPlainText(value);
  return text.length > 0 ? text : undefined;
}

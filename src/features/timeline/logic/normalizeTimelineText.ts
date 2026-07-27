import { richTextToPlainText } from '@/features/shared/logic/richText';

export function normalizeTimelineText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  const text = richTextToPlainText(value);
  if (text.length > 0) {
    return text;
  }

  if (typeof value === 'object' && !Array.isArray(value) && 'plain' in value) {
    const plain = value.plain;
    if (typeof plain === 'string') {
      const trimmed = plain.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  }

  return undefined;
}
